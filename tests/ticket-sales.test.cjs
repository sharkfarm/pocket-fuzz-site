const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const fs = require("node:fs");
const source = fs.readFileSync("lib/ticket-sales.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const helpers = { exports: {} };
new Function("exports", "require", "module", compiled)(helpers.exports, require, helpers);
const { parseMountainCutoff, mountainDateTimeInput, ticketSalesClosed } = helpers.exports;
test("optional cutoff remains unset", () => {
  assert.equal(parseMountainCutoff(null), null);
  assert.equal(parseMountainCutoff(""), null);
  assert.equal(ticketSalesClosed(null), false);
});
test("Denver summer and winter offsets, independent of server timezone", () => {
  assert.equal(parseMountainCutoff("2026-07-15T19:30"), "2026-07-16T01:30:00.000Z");
  assert.equal(parseMountainCutoff("2026-12-15T19:30"), "2026-12-16T02:30:00.000Z");
  assert.equal(mountainDateTimeInput("2026-12-16T02:30:00.000Z"), "2026-12-15T19:30");
  assert.equal(mountainDateTimeInput("2026-07-16T06:00:00.000Z"), "2026-07-16T00:00");
});
test("invalid, skipped and ambiguous DST times are rejected", () => {
  for (const value of ["garbage", "2026-02-30T12:00", "2026-03-08T02:30", "2026-11-01T01:30"]) {
    assert.throws(() => parseMountainCutoff(value));
  }
});
test("closes exactly at cutoff and fails closed for malformed stored values", () => {
  const cutoff = "2026-10-15T02:00:00.000Z";
  const instant = Date.parse(cutoff);
  assert.equal(ticketSalesClosed(cutoff, instant - 1), false);
  assert.equal(ticketSalesClosed(cutoff, instant), true);
  assert.equal(ticketSalesClosed(cutoff, instant + 1), true);
  assert.equal(ticketSalesClosed("invalid"), true);
});
