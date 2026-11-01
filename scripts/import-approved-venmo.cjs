// Run with: node --env-file=.env.local scripts/import-approved-venmo.cjs [--apply]
// Credentials stay in environment memory. Output is aggregate counts only.
const fs = require("node:fs");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");
const compiled = ts.transpileModule(fs.readFileSync("lib/venmo-ledger-import.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const helper = { exports: {} };
new Function("exports", "require", "module", compiled)(helper.exports, require, helper);
async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing server database configuration.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 2 });
  if (error) throw new Error(error.message);
  if (data.users.length !== 1) throw new Error("Use the authenticated Band Ledger import button when more than one admin identity exists.");
  const apply = process.argv.includes("--apply");
  const result = await helper.exports.importApprovedVenmoDeposits(db, data.users[0].id, !apply);
  console.log(JSON.stringify({ mode: apply ? "applied" : "preview", ...result, depositTotal: (result.depositCents / 100).toFixed(2) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
