# Ticket cutoff deployment

1. Run supabase/04-ticket-sales-cutoff.sql in the Supabase SQL editor BEFORE deploying this version. It adds a nullable shows.ticket_sales_cutoff timestamp and a trigger rejecting new show orders when sales are unavailable or the cutoff has passed.
2. Deploy the Next.js application to the existing Vercel project. No new or changed environment variables are required. Keep existing Supabase, Venmo, Resend/receipt, Meta and PF-Com settings.
3. In the show editor, set Ticket Sales Status to On Sale and optionally enter the cutoff in Mountain Time. Blank removes the cutoff. Denver daylight saving rules apply; repeated/skipped transition times are rejected with an error.
4. Verify on a test show: before the deadline checkout works, at/after the deadline show and buy pages display Online Ticket Sales Closed, and submitting an old open form cannot create an order. Verify the mobile menu and checkout on a phone.

Existing shows receive a null cutoff and retain their sales-status setting. No cron job or Vercel timezone setting is needed. Client pages hide purchasing controls at the deadline; the server action and database insertion trigger enforce it independently. Venmo links/QR instructions on existing payment pages also disappear at cutoff. Customers who already sent payment can still submit their username, and admins can review orders and send receipts as before. An already-open external Venmo app cannot be revoked.

Merchandise-only orders (show_id = null) are unaffected. The migration does not alter order approval, ticket inventory, receipt emails or PF-Com integration.

Automated cutoff regression checks: node --test tests/ticket-sales.test.cjs.


# Show bookkeeping ledger

Apply supabase/05-show-ledger.sql before deploying this version. It creates an authenticated-only per-show cash activity table with immutable manual entries and reasoned voids. It follows the existing admin authorization model (authenticated admin users); no anonymous ledger access is allowed. No environment changes are required.

The ledger is in each show detail page. It reads approved show-linked Venmo orders, actual expense rows and paid member payouts live, so editing a source updates the ledger. Pending/declined/cancelled orders, projected ticket sales and unpaid member allocations are excluded. Ticket/merch totals and calculated band payout are reconciliation references, not extra ledger receipts. Merchandise orders with no show are excluded.

Manual entries support non-Venmo receipts, settlement receipts, other cash spending/fees/refunds, and internal deposits/transfers. A deposit between accounts is a transfer, not income. Manual entries do not change source ticket counts, merchandise quantities, show profit or assigned payouts: use the existing Expenses and Member Payouts sections for those. Do not duplicate an automatically linked record with a manual entry. Actual expense costs are not a guarantee of bank payment; recorded net is not a reconciled bank balance.

Source activity remains editable in the existing source sections; only manual ledger entries are immutable. Correct a manual entry by voiding it with a reason and posting a replacement. CSV export uses the visible filtered rows; running net retains full-show context. Dates use Mountain Time.

Deployment smoke checks: add a manual cash receipt, add a Venmo-to-checking transfer (net must not change), void the receipt, export CSV, update an expense/member payout, and approve a test Venmo order. Check that each source appears once and pending orders do not affect net. Verify external-ticket URL/note fields and standard ticket controls at phone and desktop widths.

# Band-wide checking register (replaces the per-show ledger UI)

Apply supabase/06-band-ledger.sql before deploying. Migration 05 is NOT required for a fresh install of the band register. No new environment variables or PF-Com endpoint are needed.

Open Admin → Band Ledger (/admin/ledger). The register columns are Date, Payee, Category, Show, Memo, Payment, Deposit, Balance. Show is optional; all shows share ONE running balance. The show choices read the same shows table used by the existing /api/pf-com/shows feed to PF-Com. Transactions preserve a show label if that show is later deleted.

Record exactly one positive payment OR deposit per transaction. To establish an opening balance, post an Opening balance entry dated before the first transaction: deposit for positive, payment for negative. Backdated entries recompute later balances. Entries on the same date use database posting sequence. Search and show/category filters do not recalculate or isolate the band balance. All history is fetched in pages to avoid Supabase's default row limit.

This is a register of actual money movements. It does not automatically post expected ticket income, unverified expense payments, member allocations or Venmo orders. Tag a show and put receipt/Venmo details in Memo when posting the actual transaction. Ticket counts, merch inventory, show profit and payouts stay managed through the existing show features. Transfers between funds already included in the band balance are not additional income.

If migration 05 was applied, migration 06 copies explicitly posted show-ledger receipts/payments once, including void history and show associations. Original IDs prevent duplicate imports. Internal transfers are not imported because they did not change the previous band-wide cash total; review those separately if this register is intended to track only a checking account rather than all band funds. The original show ledger table is retained; no old data is deleted. Automatically derived source activity is not copied as transactions. Legacy memo text over 2,000 characters is truncated in the copy; the full original remains in the old table.

The former show ledger widget is replaced with links to the global register and a show-tag filter. Posted transactions are immutable: void with a reason and post a correction. Duplicate submissions reuse the same entry ID and cannot create a second transaction.

Smoke checks: post an opening balance and general-band payment, post receipts for two shows, verify one running balance, filter by one show without resetting balances, backdate an entry, void an entry, export CSV, and verify phone/desktop layouts. Migration/data import and visual verification must be checked in the target environment.
