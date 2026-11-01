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
