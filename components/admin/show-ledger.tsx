import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildShowLedger, LEDGER_CATEGORIES, type ManualLedgerEntry } from "@/lib/show-ledger";
import { postLedgerEntry } from "@/app/admin/shows/[id]/ledger/actions";
import LedgerActivity from "./ledger-activity";
import LedgerSubmit from "./ledger-submit";

const control = "mt-2 block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-3";
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
type Overview = { tickets: number; ticketGross: number; bandTicketPayout: number; merchGross: number; merchProfit: number; assignedPayouts: number; paidPayouts: number };

export default async function ShowLedger({ showId, overview }: { showId: string; overview: Overview }) {
  const db = await createClient();
  const [manual, expenses, payouts, orders] = await Promise.all([
    db.from("show_ledger_entries").select("*").eq("show_id", showId).order("entry_date"),
    db.from("expenses").select("id,category,description,actual_amount,payment_method,paid_by,created_at").eq("show_id", showId),
    db.from("show_payments").select("id,member_name,amount,paid,paid_at,created_at").eq("show_id", showId),
    db.from("venmo_orders").select("id,order_number,expected_amount,status,reviewed_at,created_at").eq("show_id", showId),
  ]);
  const errors = [manual.error, expenses.error, payouts.error, orders.error].filter(Boolean);
  if (errors.length) return <section id="bookkeeping" className="mt-8 rounded-2xl border border-amber-800 bg-stone-900 p-6">
    <h2 className="text-xl font-black uppercase">Show Bookkeeping Ledger</h2>
    <p className="mt-3 text-amber-200">The ledger could not load. No incomplete balance is displayed.</p>
    <p className="mt-2 text-sm text-stone-400">If the ledger table is missing, apply supabase/05-show-ledger.sql in Supabase before using this section.</p>
    {errors.map((error, i) => <p key={i} className="mt-2 text-sm text-stone-400">{error?.message}</p>)}
  </section>;
  const ledger = buildShowLedger({ showId, manual: (manual.data ?? []) as ManualLedgerEntry[],
    expenses: expenses.data ?? [], payouts: payouts.data ?? [], orders: orders.data ?? [] });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <section id="bookkeeping" className="mt-8 scroll-mt-32 rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-black uppercase">Show Bookkeeping Ledger</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">Approved Venmo receipts, actual show expenses, and paid member payouts appear automatically. Add only movements not already recorded. Pending, declined, and cancelled Venmo orders are excluded.</p>
      </div>
      <a href="#ledger-new-entry" className="min-h-11 rounded-lg border border-stone-600 px-4 py-3 text-sm font-bold">Add Ledger Entry</a>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Recorded receipts" value={money(ledger.received)} />
      <Metric label="Recorded outgoings" value={money(ledger.spent)} />
      <Metric label="Recorded net" value={money(ledger.balance)} />
      <Metric label="Transfers / deposits" value={money(ledger.transferred)} />
    </div>
    <p className="mt-3 text-xs leading-5 text-stone-400">Recorded net starts at zero for this show. It is not a verified bank balance or show profit: actual expenses may include costs paid personally, and Venmo receipts include customer fees before processor deductions. Transfers do not change net. Source dates use Mountain Time; expense dates are when the source record was created.</p>
    <details className="mt-5 rounded-xl border border-stone-700 p-4" open>
      <summary className="min-h-8 cursor-pointer font-bold">Linked show totals for reconciliation</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tickets sold" value={String(overview.tickets)} />
        <Metric label="Ticket gross" value={money(Math.round(overview.ticketGross * 100))} />
        <Metric label="Calculated band ticket payout" value={money(Math.round(overview.bandTicketPayout * 100))} />
        <Metric label="Merch gross / profit" value={money(Math.round(overview.merchGross * 100)) + " / " + money(Math.round(overview.merchProfit * 100))} />
        <Metric label="Member payouts assigned / paid" value={money(Math.round(overview.assignedPayouts * 100)) + " / " + money(Math.round(overview.paidPayouts * 100))} />
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-400">These totals are references, not additional receipts. Venmo sales already feed ticket/merch records on approval; adding both totals to receipts would count them twice. Cash ticket sales and venue settlements need a ledger receipt when money is collected. Standalone merch orders without a show are not included.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold text-red-400">
        <a href="#show-expenses">Manage Show Expenses</a><a href="#member-payouts">Manage Member Payouts</a><Link href="/admin/venmo">Review Venmo Orders</Link>
      </div>
    </details>
    <LedgerActivity rows={ledger.rows} showId={showId} />
    <details id="ledger-new-entry" className="mt-6 scroll-mt-32 rounded-xl border border-stone-700 p-4" open>
      <summary className="cursor-pointer font-bold">Add a receipt, cash movement, or adjustment</summary>
      <p className="mt-3 text-sm leading-6 text-stone-400">Ledger entries track money movement and do not change ticket inventory, merch quantities, or calculated show profit. Add show costs in Expenses and member payouts in their existing sections so those calculations stay linked. Use ledger spending only for other cash movements; do not enter the same expense or Venmo receipt twice.</p>
      <form action={postLedgerEntry} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <input type="hidden" name="show_id" value={showId} />
        <input type="hidden" name="entry_id" value={crypto.randomUUID()} />
        <label className="min-w-0 text-sm font-semibold">Entry date (Mountain Time)<input name="entry_date" type="date" defaultValue={today} required className={control} /></label>
        <label className="min-w-0 text-sm font-semibold">Category<select name="category" required className={control}>
          {Object.entries(LEDGER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label className="min-w-0 text-sm font-semibold">Amount ($)<input name="amount" type="number" min="0.01" max="99999999.99" step="0.01" required className={control} /></label>
        <label className="min-w-0 text-sm font-semibold">Account / payment method<input name="account" maxLength={120} placeholder="Cash, Venmo, checking…" required className={control} /></label>
        <label className="min-w-0 text-sm font-semibold">Destination account (transfers only)<input name="to_account" maxLength={120} placeholder="e.g. Band checking" className={control} /></label>
        <label className="min-w-0 text-sm font-semibold">Reference / receipt #<input name="reference" maxLength={200} className={control} /></label>
        <label className="min-w-0 text-sm font-semibold sm:col-span-2 xl:col-span-3">Description / counterparty<input name="description" maxLength={300} required className={control} /></label>
        <label className="min-w-0 text-sm font-semibold sm:col-span-2 xl:col-span-3">Notes<textarea name="notes" rows={2} maxLength={2000} className={control} /></label>
        <div className="sm:col-span-2 xl:col-span-3"><LedgerSubmit>Post Ledger Entry</LedgerSubmit></div>
      </form>
    </details>
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-stone-800 bg-stone-950 p-4"><p className="text-xs text-stone-400">{label}</p><p className="mt-2 text-lg font-black">{value}</p></div>;
}
