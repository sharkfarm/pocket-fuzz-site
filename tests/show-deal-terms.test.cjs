const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
function load(path, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const result = { exports: {} };
  new Function("exports", "require", "module", output)(result.exports, (name) => imports[name] ?? require(name), result);
  return result.exports;
}
const helper = load("lib/show-deal-terms.ts");
const values = {
  facility_fee_per_ticket: 0, package_expenses: 125, deal_base_percent: 45,
  deal_tier_1_threshold: 20, deal_tier_1_percent: 55,
  deal_tier_2_threshold: 80, deal_tier_2_percent: 75,
};
function form() {
  const data = new FormData();
  data.set("show_id", "show-1");
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}
test("custom show terms including zero facility fee survive parsing", () => {
  assert.deepEqual(helper.parseShowDealTerms(form()), values);
});
test("missing or blank fields cannot silently restore venue defaults", () => {
  for (const key of Object.keys(values)) {
    const data = form();
    data.delete(key);
    assert.throws(() => helper.parseShowDealTerms(data));
    data.set(key, "");
    assert.throws(() => helper.parseShowDealTerms(data));
  }
});
test("invalid percentages, amounts and tier thresholds are rejected", () => {
  for (const [key, value] of [
    ["facility_fee_per_ticket", "-1"], ["package_expenses", "NaN"],
    ["deal_base_percent", "101"], ["deal_tier_1_threshold", "1.5"],
    ["deal_tier_2_threshold", "10"],
  ]) {
    const data = form(); data.set(key, value);
    assert.throws(() => helper.parseShowDealTerms(data));
  }
});
function actions(database) {
  return load("app/admin/shows/[id]/actions.ts", {
    "@/lib/show-deal-terms": helper,
    "@/lib/ticket-sales": {},
    "@/lib/supabase/server": { createClient: async () => database },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path) { throw new Error("REDIRECT:" + path); } },
  });
}
test("deal save updates only this show and verifies returned database values", async () => {
  let stored; let filteredId;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from(table) {
      assert.equal(table, "shows");
      return { update(terms) { stored = terms; return {
        eq(key, id) { assert.equal(key, "id"); filteredId = id; return {
          select() { return { single: async () => ({ data: stored, error: null }) }; },
        }; },
      }; } };
    },
  };
  await assert.rejects(actions(db).updateShowDealTerms(form()), /saved=deal-terms/);
  assert.equal(filteredId, "show-1");
  assert.deepEqual(stored, values);
});
test("ticket-only saves never overwrite show deal terms with defaults", async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from() { assert.fail("No ticket rows submitted: no database write should occur"); },
  };
  const data = new FormData(); data.set("show_id", "show-1");
  await assert.rejects(actions(db).updateTicketSales(data), /saved=tickets/);
});
test("a denied or database-overridden update cannot report success", async () => {
  for (const result of [
    { data: null, error: { message: "Update denied" } },
    { data: { ...values, facility_fee_per_ticket: 2 }, error: null },
  ]) {
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
      from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => result }) }) }) }),
    };
    await assert.rejects(actions(db).updateShowDealTerms(form()), /\?error=/);
  }
});
