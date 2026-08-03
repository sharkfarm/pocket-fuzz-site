# Pocket Fuzz Tour Manager V2 cleanup

This bundle consolidates the admin dashboard, band roster, venues, booking CRM,
show details, expenses, merchandise, band payouts, reports, public show pages,
and the Venmo-first order flow.

## Important route cleanup

Your previous project mixed `[id]` and `[slug]` under `app/shows`, which causes
Next.js dynamic-route conflicts. V2 uses:

- `app/admin/shows/[id]` for private admin show records
- `app/shows/[slug]` for public show pages

Before copying V2, delete both old public dynamic folders if they exist:

```powershell
Remove-Item -Recurse -Force "app/shows/[id]" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "app/shows/[slug]" -ErrorAction SilentlyContinue
```

Do not delete `app/admin/shows/[id]`.

Remove the abandoned Stripe routes if they were copied earlier:

```powershell
Remove-Item -Recurse -Force "app/api/checkout" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "app/api/stripe" -ErrorAction SilentlyContinue
```

## Install

1. Back up the project or commit it to Git.
2. Copy the contents of this bundle into the project root.
3. Run the SQL migrations in order:
   - `supabase/01-phases-2-4.sql`
   - `supabase/02-show-payments.sql`
   - `supabase/03-venmo-orders.sql`
4. Confirm `.env.local` contains:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

5. Clear the cache and build:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
npm run dev
```

## Public show setup

For a show to appear at `/shows`, its database record must have:

- `is_public = true`
- a non-null unique `public_slug`

Example URL:

`http://localhost:3000/shows/globe-hall-aug-9`

## Venmo workflow

1. Buyer chooses tickets and merchandise.
2. A pending order is saved before Venmo opens.
3. Venmo opens for `@pocketfuzz` with the amount and order number.
4. The payment page already knows the order contents and shirt size.
5. Buyer enters the Venmo username used.
6. Admin verifies the payment at `/admin/venmo` and approves it.
7. Approval updates ticket quantities and merchandise sales.

## Notes

- This is a consolidation bundle, not a replacement for your public homepage.
- Keep your existing `lib/supabase/client.ts`, `lib/supabase/server.ts`, login,
  logout, proxy, global CSS, root layout, and public homepage.
- The V2 public page contains no admin-only form components such as
  `ExpenseField`.
