const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
function load(path, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", output)(module.exports, name => imports[name] ?? require(name), module);
  return module.exports;
}
const helper = load("lib/band-ledger.ts");
const showId = "11111111-1111-1111-1111-111111111111";
const otherShow = "22222222-2222-2222-2222-222222222222";
const entryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
function entry(id, sequence, payment, deposit, extra = {}) {
  return { id, sequence, entry_date: "2026-11-01", payee: "Test " + id, category: "other",
    show_id: null, show_label: null, memo: null, payment, deposit,
    created_at: "2026-11-01T12:00:00Z", voided_at: null, void_reason: null, ...extra };
}
function form(extra = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ entry_id: entryId, entry_date: "2026-11-01",
    payee: "Venue", category: "ticket_sales", payment: "", deposit: "12.34", show_id: "", ...extra })) form.set(key, value);
  return form;
}
test("one checking balance spans all shows and unassigned band transactions", () => {
  const result = helper.bandLedgerRegister([
    entry("opening", 1, 0, "1000", { category: "opening_balance" }),
    entry("one", 2, 0, "12.34", { show_id: showId }),
    entry("two", 3, "20.10", 0, { show_id: otherShow }),
    entry("general", 4, "2.24", 0),
  ]);
  assert.deepEqual(result.rows.map(r => r.balance), [100000, 101234, 99224, 99000]);
  assert.equal(result.balance, 99000);
  assert.equal(result.payments, 2234);
  assert.equal(result.deposits, 101234);
  assert.equal(result.rows.filter(r => r.show_id === otherShow)[0].balance, 99224);
});
test("backdating recomputes every subsequent balance and same-day sequence is stable", () => {
  const result = helper.bandLedgerRegister([
    entry("later", 1, "5", 0, { entry_date: "2026-11-02" }),
    entry("same-late", 8, 0, "3"),
    entry("backdated", 9, 0, "10", { entry_date: "2026-10-01" }),
    entry("same-first", 2, "2", 0),
  ]);
  assert.deepEqual(result.rows.map(r => r.id), ["backdated", "same-first", "same-late", "later"]);
  assert.deepEqual(result.rows.map(r => r.balance), [1000, 800, 1100, 600]);
});
test("void history is preserved but never changes the balance", () => {
  const result = helper.bandLedgerRegister([
    entry("1", 1, 0, "100", { voided_at: "2026-11-02T00:00:00Z", void_reason: "Duplicate" }),
    entry("2", 2, "10", 0),
  ]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.balance, -1000);
  assert.equal(result.deposits, 0);
});
test("show labels use the shared live list and retain history after deletion", () => {
  const original = entry("1", 1, 0, "10", { show_id: showId, show_label: "Old show" });
  assert.equal(helper.bandLedgerRegister([original], [{ id: showId, show_name: "New title", show_date: "2026-11-10" }]).rows[0].showName, "2026-11-10 · New title");
  assert.equal(helper.bandLedgerRegister([{ ...original, show_id: null }]).rows[0].showName, "Old show");
});
test("amount direction is explicit, optional show stays optional, and invalid money is rejected", () => {
  assert.equal(helper.parseBandLedgerEntry(form()).deposit, 12.34);
  assert.equal(helper.parseBandLedgerEntry(form()).show_id, null);
  assert.equal(helper.parseBandLedgerEntry(form({ show_id: showId })).show_id, showId);
  assert.equal(helper.parseBandLedgerEntry(form({ category: "opening_balance", deposit: "", payment: "10" })).payment, 10);
  for (const invalid of [
    { payment: "1" }, { deposit: "", payment: "" }, { deposit: "0" },
    { deposit: "-1" }, { deposit: "1.234" }, { deposit: "1e3" },
    { deposit: "NaN" }, { deposit: "Infinity" }, { entry_date: "2026-02-30" },
    { payee: "" }, { payee: "x".repeat(301) }, { memo: "x".repeat(2001) },
    { category: "__proto__" }, { show_id: "made-up-show" },
  ]) assert.throws(() => helper.parseBandLedgerEntry(form(invalid)));
});
test("CSV contains the register columns, separate money columns, safe quoting and real rows", () => {
  const result = helper.bandLedgerRegister([entry("1", 1, 0, "12.34", { payee: '=HYPERLINK("bad")', memo: 'A "quoted" note\nnew line' })]);
  const csv = helper.bandLedgerCsv(result.rows);
  assert.ok(csv.startsWith('"Date","Payee","Category","Show","Memo","Payment","Deposit","Balance"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('A ""quoted"" note'));
  assert.ok(csv.includes("\r\n"));
  assert.ok(csv.includes('"","12.34","12.34"'));
});
function actions(db) {
  return load("app/admin/ledger/actions.ts", {
    "@/lib/band-ledger": helper,
    "@/lib/supabase/server": { createClient: async () => db },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
  });
}
const auth = { getUser: async () => ({ data: { user: { id: "admin" } } }) };
test("posting general band money does not require a show lookup; identity prevents retries duplicating money", async () => {
  let saved; const ids = new Set();
  const db = { auth, from(table) {
    assert.equal(table, "band_ledger_entries");
    return { insert: async value => {
      if (ids.has(value.id)) return { error: { code: "23505", message: "Duplicate" } };
      ids.add(value.id); saved = value; return { error: null };
    } };
  } };
  await assert.rejects(actions(db).postBandLedgerEntry(form()), /saved=posted/);
  assert.equal(saved.show_id, null); assert.equal(saved.show_label, null);
  assert.equal(saved.created_by, "admin"); assert.equal(saved.deposit, 12.34);
  await assert.rejects(actions(db).postBandLedgerEntry(form()), /already%20posted/);
  assert.equal(ids.size, 1);
});
test("selected show is verified server-side, never accepted as a client-supplied label", async () => {
  let saved;
  const db = { auth, from(table) {
    if (table === "shows") return { select: () => ({ eq: (key, id) => {
      assert.equal(id, showId);
      return { single: async () => ({ data: { id, show_name: "Venue Night", show_date: "2026-11-10" }, error: null }) };
    } }) };
    return { insert: async value => { saved = value; return { error: null }; } };
  } };
  await assert.rejects(actions(db).postBandLedgerEntry(form({ show_id: showId, show_label: "Forged label" })), /saved=posted/);
  assert.equal(saved.show_label, "2026-11-10 · Venue Night");
  const missing = { auth, from(table) {
    assert.equal(table, "shows");
    return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
  } };
  await assert.rejects(actions(missing).postBandLedgerEntry(form({ show_id: showId })), /selected%20show/);
});
test("posting and voiding require authentication", async () => {
  const db = { auth: { getUser: async () => ({ data: { user: null } }) }, from() { assert.fail("No anonymous write"); } };
  await assert.rejects(actions(db).postBandLedgerEntry(form()), /admin\/login/);
  await assert.rejects(actions(db).voidBandLedgerEntry(form()), /admin\/login/);
});
test("voiding requires a reason, guards already-voided rows and records actor", async () => {
  let saved; const filters = [];
  const chain = {
    eq(k,v) { filters.push([k,v]); return this; },
    is(k,v) { filters.push([k,v]); return this; },
    select() { return this; }, single: async () => ({ data: { id: entryId }, error: null }),
  };
  const db = { auth, from: () => ({ update(value) { saved = value; return chain; } }) };
  await assert.rejects(actions(db).voidBandLedgerEntry(form({ void_reason: "Wrong amount" })), /saved=voided/);
  assert.equal(saved.voided_by, "admin");
  assert.deepEqual(filters, [["id", entryId], ["voided_at", null]]);
  await assert.rejects(actions(db).voidBandLedgerEntry(form()), /void%20reason/);
  chain.single = async () => ({ data: null, error: null });
  await assert.rejects(actions(db).voidBandLedgerEntry(form({ void_reason: "Duplicate" })), /not%20found/);
});
test("page fetches beyond Supabase row limits before calculating the band balance", async () => {
  const entries = Array.from({ length: 1101 }, (_, i) => entry(String(i), i + 1, 0, "1"));
  const requested = [];
  const db = { auth, from(table) {
    const chain = {
      select() { return this; }, order() { return this; },
      range(start, end) {
        requested.push([table, start, end]);
        return Promise.resolve({ data: (table === "band_ledger_entries" ? entries : []).slice(start, end + 1), error: null });
      },
    }; return chain;
  } };
  function Register() { return null; }
  const page = load("app/admin/ledger/page.tsx", {
    "@/lib/band-ledger": helper, "@/lib/supabase/server": { createClient: async () => db },
    "@/components/admin/band-ledger": { __esModule: true, default: Register },
    "next/navigation": { redirect() { throw new Error("redirect"); } },
  }).default;
  const root = await page({ searchParams: Promise.resolve({}) });
  function find(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === Register) return node.props.register;
    for (const child of [].concat(node.props?.children || [])) { const result = find(child); if (result) return result; }
    return null;
  }
  assert.equal(find(root).balance, 110100);
  assert.deepEqual(requested.filter(r => r[0] === "band_ledger_entries").map(r => r[1]), [0, 500, 1000]);
});
