const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
function load(path, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", output)(module.exports, name => imports[name] ?? require(name), module);
  return module.exports;
}
const ledger = load("lib/show-ledger.ts");
const base = { showId: "show-1", manual: [], expenses: [], payouts: [], orders: [] };
const manual = (id, category, amount, extra = {}) => ({
  id, entry_date: "2026-11-01", category, amount, account: "Cash",
  to_account: null, description: "Test " + id, reference: null, notes: null,
  created_at: "2026-11-01T12:00:00Z", voided_at: null, void_reason: null, ...extra,
});
function form(extra = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    show_id: "show-1", entry_id: "12345678-1234-1234-1234-123456789abc", entry_date: "2026-11-01", category: "ticket_receipt",
    amount: "12.34", account: "Cash", description: "Cash ticket payment", ...extra,
  })) form.set(key, value);
  return form;
}
test("money uses cents, and transfers/deposits never create revenue", () => {
  const result = ledger.buildShowLedger({ ...base, manual: [
    manual("1", "ticket_receipt", "12.34"), manual("2", "spending", "2.10"),
    manual("3", "bank_deposit", "10.24", { to_account: "Checking" }),
    manual("4", "account_transfer", "1.00", { to_account: "Venmo" }),
  ] });
  assert.equal(result.received, 1234);
  assert.equal(result.spent, 210);
  assert.equal(result.balance, 1024);
  assert.equal(result.transferred, 1124);
});
test("voided entries retain history but do not affect totals", () => {
  const result = ledger.buildShowLedger({ ...base, manual: [
    manual("1", "ticket_receipt", "100", { voided_at: "2026-11-02T00:00:00Z", void_reason: "Duplicate" }),
    manual("2", "ticket_receipt", "50"),
  ] });
  assert.equal(result.rows.length, 2);
  assert.equal(result.balance, 5000);
  assert.equal(result.rows[0].voided, true);
});
test("linked orders, expenses and payouts appear once; pending sales and unpaid allocations are excluded", () => {
  const result = ledger.buildShowLedger({ ...base,
    orders: ["approved", "pending", "submitted", "declined", "cancelled"].map((status, i) => ({
      id: String(i), order_number: "PF-" + i, expected_amount: "100.25", status,
      reviewed_at: null, created_at: "2026-11-02T01:30:00Z",
    })),
    expenses: [{ id: "cost", category: "Travel", description: "Fuel", actual_amount: "20",
      payment_method: "Card", paid_by: "Band", created_at: "2026-11-02T01:30:00Z" }],
    payouts: [true, false].map((paid, i) => ({ id: String(i), member_name: "Member",
      amount: "10", paid, paid_at: null, created_at: "2026-11-02T01:30:00Z" })),
  });
  assert.equal(result.rows.length, 3);
  assert.equal(result.received, 10025);
  assert.equal(result.spent, 3000);
  assert.equal(result.balance, 7025);
  assert.equal(result.rows.find(r => r.source === "venmo").date, "2026-11-01");
});
test("source corrections flow through automatically, not as duplicated ledger snapshots", () => {
  const expense = { id: "e", category: "Cost", description: null, actual_amount: "10", payment_method: null, paid_by: null, created_at: "2026-11-01T12:00:00Z" };
  assert.equal(ledger.buildShowLedger({ ...base, expenses: [expense] }).balance, -1000);
  assert.equal(ledger.buildShowLedger({ ...base, expenses: [{ ...expense, actual_amount: "15" }] }).balance, -1500);
});
test("valid entry parsing and invalid amount/date/account/category rejection", () => {
  assert.equal(ledger.parseLedgerEntry(form()).amount, 12.34);
  for (const invalid of [
    { amount: "0" }, { amount: "-1" }, { amount: "1.234" }, { amount: "Infinity" },
    { amount: "1e3" }, { entry_date: "2026-02-30" }, { category: "__proto__" },
    { description: "" }, { account: "" },
    { category: "bank_deposit" }, { category: "account_transfer", to_account: "cash" },
  ]) assert.throws(() => ledger.parseLedgerEntry(form(invalid)));
  assert.equal(ledger.parseLedgerEntry(form({ category: "bank_deposit", to_account: "Checking" })).to_account, "Checking");
});
test("CSV has real row breaks, escapes quotes and neutralizes spreadsheet formulas", () => {
  const row = { ...ledger.buildShowLedger({ ...base, manual: [manual("1", "ticket_receipt", "10")] }).rows[0],
    description: '=HYPERLINK("bad")', notes: 'Quoted "note"\nsecond line' };
  const csv = ledger.ledgerCsv([row]);
  assert.ok(csv.includes("\r\n"));
  assert.ok(!csv.includes("\\r\\n"));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('Quoted ""note""'));
});
function actions(db) {
  return load("app/admin/shows/[id]/ledger/actions.ts", {
    "@/lib/show-ledger": ledger,
    "@/lib/supabase/server": { createClient: async () => db },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
  });
}
test("posting authenticates and attaches the selected show and actor", async () => {
  let inserted;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from(table) {
      if (table === "shows") return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: "show-1" }, error: null }) }) }) };
      assert.equal(table, "show_ledger_entries");
      return { insert: async value => { inserted = value; return { error: null }; } };
    },
  };
  await assert.rejects(actions(db).postLedgerEntry(form()), /saved=ledger/);
  assert.equal(inserted.show_id, "show-1"); assert.equal(inserted.created_by, "admin");
  assert.equal(inserted.amount, 12.34);
  assert.equal(inserted.id, "12345678-1234-1234-1234-123456789abc");
  const loggedOut = { auth: { getUser: async () => ({ data: { user: null } }) }, from() { assert.fail("No unauthenticated write"); } };
  await assert.rejects(actions(loggedOut).postLedgerEntry(form()), /admin\/login/);
  await assert.rejects(actions(loggedOut).voidLedgerEntry(form()), /admin\/login/);
});
test("voiding is scoped to show and entry, requires a reason and reports no-op errors", async () => {
  const filters = []; let updated;
  const chain = {
    eq(k, v) { filters.push([k, v]); return this; },
    is(k, v) { filters.push([k, v]); return this; },
    select() { return this; },
    single: async () => ({ data: { id: "entry-1" }, error: null }),
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from: () => ({ update(value) { updated = value; return chain; } }),
  };
  await assert.rejects(actions(db).voidLedgerEntry(form({ entry_id: "entry-1", void_reason: "Wrong amount" })), /saved=ledger-void/);
  assert.deepEqual(filters, [["id", "entry-1"], ["show_id", "show-1"], ["voided_at", null]]);
  assert.equal(updated.voided_by, "admin");
  await assert.rejects(actions(db).voidLedgerEntry(form({ entry_id: "entry-1", void_reason: "" })), /\?error=/);
  chain.single = async () => ({ data: null, error: null });
  await assert.rejects(actions(db).voidLedgerEntry(form({ entry_id: "entry-1", void_reason: "Duplicate" })), /\?error=/);
});


test("duplicate posting cannot insert a second entry", async () => {
  const ids = new Set();
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from(table) {
      if (table === "shows") return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: "show-1" }, error: null }) }) }) };
      return { insert: async row => {
        if (ids.has(row.id)) return { error: { code: "23505", message: "Duplicate" } };
        ids.add(row.id); return { error: null };
      } };
    },
  };
  await assert.rejects(actions(db).postLedgerEntry(form()), /saved=ledger/);
  await assert.rejects(actions(db).postLedgerEntry(form()), /already%20posted/);
  assert.equal(ids.size, 1);
});
