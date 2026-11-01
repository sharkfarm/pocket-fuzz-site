const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(path, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", compiled)(module.exports, name => imports[name] ?? require(name), module);
  return module.exports;
}
const helper = load("lib/band-ledger.ts");
function actions(db) {
  return load("app/admin/ledger/actions.ts", {
    "@/lib/band-ledger": helper, "@/lib/venmo-ledger-import": {},
    "@/lib/supabase/server": { createClient: async () => db },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
  });
}
const auth = { getUser: async () => ({ data: { user: { id: "admin" } } }) };
function form(extra = {}) {
  const f = new FormData();
  for (const [k,v] of Object.entries({ entry_id: "entry-1", previous_category: "ticket_sales", category: "venmo", ...extra })) f.set(k,v);
  return f;
}
test("category edit updates only category and is scoped to the original value and nonvoided row", async () => {
  const filters = []; let updated;
  const chain = {
    eq(k,v) { filters.push([k,v]); return this; },
    is(k,v) { filters.push([k,v]); return this; },
    select() { return this; },
    single: async () => ({ data: { id: "entry-1", category: "venmo" }, error: null }),
  };
  const db = { auth, from(table) {
    assert.equal(table, "band_ledger_entries");
    return { update(value) { updated = value; return chain; } };
  } };
  assert.deepEqual(await actions(db).updateBandLedgerCategory(form()), { error: null });
  assert.deepEqual(updated, { category: "venmo" });
  assert.deepEqual(filters, [["id", "entry-1"], ["category", "ticket_sales"], ["voided_at", null]]);
});
test("category changes require authentication, allowed categories, and a valid original category", async () => {
  const noWrites = { auth, from() { assert.fail("No invalid update"); } };
  for (const value of [{ category: "__proto__" }, { previous_category: "invalid" }, { entry_id: "" }]) {
    const result = await actions(noWrites).updateBandLedgerCategory(form(value));
    assert.ok(result.error);
  }
  assert.deepEqual(await actions(noWrites).updateBandLedgerCategory(form({ category: "ticket_sales" })), { error: null });
  const loggedOut = { ...noWrites, auth: { getUser: async () => ({ data: { user: null } }) } };
  await assert.rejects(actions(loggedOut).updateBandLedgerCategory(form()), /admin\/login/);
});
test("stale/voided rows, policy errors and database overrides do not report a successful category save", async () => {
  for (const result of [
    { data: null, error: null },
    { data: null, error: { message: "Policy denied" } },
    { data: { id: "entry-1", category: "ticket_sales" }, error: null },
  ]) {
    const chain = { eq() { return this; }, is() { return this; }, select() { return this; }, single: async () => result };
    const db = { auth, from: () => ({ update: () => chain }) };
    assert.ok((await actions(db).updateBandLedgerCategory(form())).error);
  }
});
test("new bottom row has eight aligned columns and one form owner for every editable column", () => {
  const Row = load("components/admin/ledger-entry-row.tsx", {
    "@/lib/band-ledger": helper, "@/app/admin/ledger/actions": { postBandLedgerEntry: async () => {} },
  }).default;
  const html = renderToStaticMarkup(React.createElement("table", null,
    React.createElement("tfoot", null, React.createElement(Row, {
      shows: [{ id: "show-1", show_name: "Show One", show_date: "2026-11-02" }],
      initialShow: "", entryId: "entry-1", today: "2026-11-01", balance: 12345,
    }))));
  assert.equal((html.match(/<td\b/g) || []).length, 8);
  for (const name of ["entry_date", "payee", "category", "show_id", "memo", "payment", "deposit"]) {
    const tag = html.match(new RegExp("<(?:input|select)[^>]*name=\"" + name + "\"[^>]*>"));
    assert.ok(tag, name); assert.ok(tag[0].includes('form="ledger-new-entry-1"'), name + " form owner");
  }
  assert.ok(html.includes('id="ledger-new-entry-1"'));
  assert.ok(html.includes('name="entry_id"'));
  assert.ok(html.includes("$123.45"));
  assert.ok(html.includes('type="submit"'));
  assert.ok(!html.includes("<textarea"));
});
