# Ticket cutoff deployment

1. Run supabase/04-ticket-sales-cutoff.sql in the Supabase SQL editor BEFORE deploying this version. It adds a nullable shows.ticket_sales_cutoff timestamp and a trigger rejecting new show orders when sales are unavailable or the cutoff has passed.
2. Deploy the Next.js application to the existing Vercel project. No new or changed environment variables are required. Keep existing Supabase, Venmo, Resend/receipt, Meta and PF-Com settings.
3. In the show editor, set Ticket Sales Status to On Sale and optionally enter the cutoff in Mountain Time. Blank removes the cutoff. Denver daylight saving rules apply; repeated/skipped transition times are rejected with an error.
4. Verify on a test show: before the deadline checkout works, at/after the deadline show and buy pages display Online Ticket Sales Closed, and submitting an old open form cannot create an order. Verify the mobile menu and checkout on a phone.

Existing shows receive a null cutoff and retain their sales-status setting. No cron job or Vercel timezone setting is needed. Client pages hide purchasing controls at the deadline; the server action and database insertion trigger enforce it independently. Venmo links/QR instructions on existing payment pages also disappear at cutoff. Customers who already sent payment can still submit their username, and admins can review orders and send receipts as before. An already-open external Venmo app cannot be revoked.

Merchandise-only orders (show_id = null) are unaffected. The migration does not alter order approval, ticket inventory, receipt emails or PF-Com integration.

Automated cutoff regression checks: node --test tests/ticket-sales.test.cjs.
