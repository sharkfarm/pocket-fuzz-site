const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const compiled = ts.transpileModule(fs.readFileSync("components/admin/show-ticket-editor.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const mod = { exports: {} };
new Function("exports", "require", "module", compiled)(mod.exports, require, mod);
const TicketEditor = mod.exports.default;
const ticket = {
  id: "t1", ticket_type: "Presale", channel: "online", ticket_price: "12",
  projected_quantity: 20, actual_quantity: 2, venmo_service_fee: true,
  include_in_presale_payout: true, ticket_mode: "standard", external_url: null, public_note: null,
};
test("standard cards preserve ticket editing fields and independent delete form", () => {
  const html = renderToStaticMarkup(React.createElement(TicketEditor, { tickets: [ticket] }));
  for (const name of ["ticket_id", "ticket_mode_t1", "ticket_type_t1", "ticket_channel_t1",
    "ticket_price_t1", "projected_quantity_t1", "actual_quantity_t1", "include_in_presale_payout_t1", "venmo_service_fee_t1"]) {
    assert.ok(html.includes('name="' + name + '"'), name);
  }
  assert.ok(html.includes('form="delete-ticket-t1"'));
  assert.ok(html.includes("$24.00"));
});
test("venue links have separate URL/note controls and do not enter sales totals", () => {
  const external = { ...ticket, id: "external", ticket_type: "VIP", ticket_mode: "external",
    external_url: "https://tickets.example.com/long/path", public_note: "Purchase from venue",
    actual_quantity: 100, ticket_price: "18" };
  const html = renderToStaticMarkup(React.createElement(TicketEditor, { tickets: [ticket, external] }));
  assert.ok(html.includes('name="external_url_external"'));
  assert.ok(html.includes('name="public_note_external"'));
  assert.ok(!html.includes('name="ticket_price_external"'));
  assert.ok(html.includes("2 tickets"));
  assert.ok(!html.includes("102 tickets"));
  assert.ok(!html.includes("<table"));
});
