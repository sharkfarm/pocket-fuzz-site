const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
function load(path, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(module.exports, name => imports[name] ?? require(name), module);
  return module.exports;
}
const helper = load("lib/venmo-ledger-import.ts");
function order(id = "order-1", extra = {}) {
  return { id, order_number: "PF-" + id, customer_name: "Customer", venmo_username: "customer",
    expected_amount: "12.34", service_fee: "0.34", status: "approved", submitted_at: "2026-11-02T01:30:00Z",
    reviewed_at: "2026-11-02T02:00:00Z", created_at: "2026-11-01T23:00:00Z", show_id: "show-1",
    shows: { show_name: "Show One", show_date: "2026-11-03" },
    venmo_order_items: [{ item_kind: "ticket", item_name: "Presale", item_option: null, quantity: 1 }], ...extra };
}
function database(orders, existing = []) {
  const rows = new Map(existing.map(row => [row.id, row]));
  const ranges = []; let writeCalls = 0;
  const db = { rows, ranges, failWrite: 0, from(table) {
    if (table === "venmo_orders") {
      let status;
      return { select() { return this; }, eq(key, value) { assert.equal(key, "status"); status = value; return this; },
        order() { return this; }, async range(start, end) { ranges.push(start); return { data: orders.filter(o => o.status === status).slice(start, end + 1), error: null }; } };
    }
    assert.equal(table, "band_ledger_entries");
    return {
      select() { return { in: async (key, ids) => ({ data: ids.filter(id => rows.has(id)).map(id => ({ id })), error: null }) }; },
      upsert(batch, options) {
        assert.deepEqual(options, { onConflict: "id", ignoreDuplicates: true });
        return { select: async () => {
          writeCalls++;
          if (db.failWrite === writeCalls) return { data: null, error: { message: "Test interruption" } };
          const inserted = [];
          for (const row of batch) if (!rows.has(row.id)) { rows.set(row.id, row); inserted.push({ id: row.id, deposit: row.deposit }); }
          return { data: inserted, error: null };
        } };
      },
    };
  } };
  return db;
}
test("imports gross payment, customer, source identity, show and payment date in Mountain Time", () => {
  const row = helper.venmoLedgerDeposit(order(), "admin");
  assert.equal(row.id, "order-1"); assert.equal(row.payee, "Customer");
  assert.equal(row.deposit, 12.34); assert.equal(row.payment, 0);
  assert.equal(row.entry_date, "2026-11-01"); assert.equal(row.created_by, "admin");
  assert.equal(row.category, "ticket_sales"); assert.equal(row.show_id, "show-1");
  assert.equal(row.show_label, "2026-11-03 · Show One");
  assert.match(row.memo, /PF-order-1/); assert.match(row.memo, /0.34 customer service fee/);
  assert.match(row.memo, /Actual processor fees are not deducted/);
});
test("handles merchandise, mixed items, no show, and missing customer payment timestamps", () => {
  const merch = [{ item_kind: "merch", item_name: "Shirt", item_option: "XL", quantity: 2 }];
  const row = helper.venmoLedgerDeposit(order("m", { submitted_at: null, show_id: null, shows: null, venmo_order_items: merch }), "admin");
  assert.equal(row.category, "merch_sales"); assert.equal(row.show_id, null); assert.equal(row.show_label, null);
  assert.match(row.memo, /Shirt \(XL\)/);
  const mixed = helper.venmoLedgerDeposit(order("mix", { venmo_order_items: [...merch, ...order().venmo_order_items] }), "admin");
  assert.equal(mixed.category, "venmo");
  const fallback = helper.venmoLedgerDeposit(order("fallback", { submitted_at: null, reviewed_at: null }), "admin");
  assert.equal(fallback.entry_date, "2026-11-01");
});
test("rejects nonapproved/bad source data and excludes zero-dollar orders", () => {
  for (const extra of [{ status: "pending" }, { expected_amount: "-1" }, { expected_amount: "NaN" }, { submitted_at: "invalid" }]) {
    assert.throws(() => helper.venmoLedgerDeposit(order("bad", extra), "admin"));
  }
  assert.equal(helper.venmoLedgerDeposit(order("free", { expected_amount: 0 }), "admin"), null);
});
test("loads every page, imports approved receipts once, and reruns do not resurrect voided entries", async () => {
  const orders = Array.from({ length: 205 }, (_, i) => order(String(i)));
  orders.push(order("pending", { status: "pending" }));
  const db = database(orders);
  const result = await helper.importApprovedVenmoDeposits(db, "admin");
  assert.equal(result.imported, 205); assert.equal(result.depositCents, 205 * 1234); assert.equal(db.rows.size, 205);
  assert.deepEqual(db.ranges, [0, 100, 200]);
  db.rows.get("0").voided_at = "2026-11-03T00:00:00Z";
  const again = await helper.importApprovedVenmoDeposits(db, "admin");
  assert.equal(again.imported, 0); assert.equal(again.skipped, 205); assert.equal(again.depositCents, 0);
  assert.ok(db.rows.get("0").voided_at);
});
test("dry run is read-only and only totals missing source IDs", async () => {
  const db = database([order("one"), order("two"), order("free", { expected_amount: 0 })], [{ id: "one" }]);
  const result = await helper.importApprovedVenmoDeposits(db, "admin", true);
  assert.equal(result.imported, 1); assert.equal(result.skipped, 1);
  assert.equal(result.zeroAmount, 1); assert.equal(result.depositCents, 1234); assert.equal(db.rows.size, 1);
});
test("concurrent runs cannot duplicate the same orders", async () => {
  const db = database([order("1"), order("2")]);
  const results = await Promise.all([helper.importApprovedVenmoDeposits(db, "a"), helper.importApprovedVenmoDeposits(db, "b")]);
  assert.equal(results.reduce((sum, r) => sum + r.imported, 0), 2); assert.equal(db.rows.size, 2);
});
test("partial failure reports progress and a retry safely completes remaining batches", async () => {
  const db = database(Array.from({ length: 105 }, (_, i) => order(String(i))));
  db.failWrite = 2;
  await assert.rejects(helper.importApprovedVenmoDeposits(db, "admin"), /after 100 new deposits/);
  assert.equal(db.rows.size, 100);
  db.failWrite = 0;
  const result = await helper.importApprovedVenmoDeposits(db, "admin");
  assert.equal(result.imported, 5); assert.equal(result.skipped, 100); assert.equal(db.rows.size, 105);
});
test("all source rows validate before any ledger entries are written", async () => {
  const db = database([order("valid"), order("bad", { expected_amount: "-1" })]);
  await assert.rejects(helper.importApprovedVenmoDeposits(db, "admin"), /Invalid amount/);
  assert.equal(db.rows.size, 0);
});
test("server action requires authentication and reports import results", async () => {
  let called = false;
  const make = user => load("app/admin/ledger/actions.ts", {
    "@/lib/band-ledger": {},
    "@/lib/venmo-ledger-import": { importApprovedVenmoDeposits: async (db, actor) => {
      assert.equal(actor, "admin"); called = true;
      return { imported: 35, skipped: 0, zeroAmount: 0, depositCents: 12345 };
    } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
  });
  await assert.rejects(make(null).importApprovedVenmoOrders(), /admin\/login/);
  assert.equal(called, false);
  await assert.rejects(make({ id: "admin" }).importApprovedVenmoOrders(), /saved=venmo-import/);
  assert.equal(called, true);
});
