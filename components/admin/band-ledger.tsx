"use client";
import { useState } from "react";
import Link from "next/link";
import { BAND_LEDGER_CATEGORIES, bandLedgerCsv, showLabel, type BandLedgerRow, type LedgerShow, type bandLedgerRegister } from "@/lib/band-ledger";
import { postBandLedgerEntry, voidBandLedgerEntry } from "@/app/admin/ledger/actions";
import LedgerSubmit from "./ledger-submit";

type Register = ReturnType<typeof bandLedgerRegister>;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const control = "mt-2 block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-3";
export default function BandLedger({ register, shows, initialShow, entryId, today }: {
  register: Register; shows: LedgerShow[]; initialShow: string; entryId: string; today: string;
}) {
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(initialShow);
  const [category, setCategory] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const visible = register.rows.filter(row =>
    (showVoided || !row.voided_at) && (!show || (show === "none" ? !row.show_id && !row.show_label : row.show_id === show)) &&
    (!category || row.category === category) &&
    [row.payee, row.memo, row.showName, BAND_LEDGER_CATEGORIES[row.category]].join(" ").toLowerCase().includes(search.toLowerCase()));
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([bandLedgerCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "pocket-fuzz-band-ledger.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showCell(row: BandLedgerRow) {
    return row.show_id ? <Link href={"/admin/shows/" + row.show_id} className="text-red-400 hover:underline">{row.showName}</Link> : row.showName || <span className="text-stone-500">—</span>;
  }
  return <>
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <Metric label="Total payments" value={money(register.payments)} />
      <Metric label="Total deposits" value={money(register.deposits)} />
      <Metric label="Current band balance" value={money(register.balance)} />
    </div>
    <details className="mt-6 rounded-xl border border-stone-700 bg-stone-900 p-4 sm:p-5" open={!register.rows.length}>
      <summary className="min-h-9 cursor-pointer font-black uppercase">Add Transaction</summary>
      <p className="mt-3 text-sm leading-6 text-stone-400">Enter one payment OR deposit per row. To start from an existing balance, choose Opening balance and enter a deposit for a positive balance or a payment for a negative balance. Use a date before your first transaction. The Show field is optional.</p>
      <form action={postBandLedgerEntry} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="entry_id" value={entryId} />
        <label className="min-w-0 text-sm font-bold">Date<input name="entry_date" type="date" defaultValue={today} required className={control} /></label>
        <label className="min-w-0 text-sm font-bold">Payee<input name="payee" maxLength={300} placeholder="Paid to / received from" required className={control} /></label>
        <label className="min-w-0 text-sm font-bold">Category<select name="category" defaultValue="expense" required className={control}>{Object.entries(BAND_LEDGER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="min-w-0 text-sm font-bold">Show<select name="show_id" defaultValue={initialShow} className={control}><option value="">No show / general band</option>{shows.map(s => <option key={s.id} value={s.id}>{showLabel(s)}</option>)}</select></label>
        <label className="min-w-0 text-sm font-bold sm:col-span-2">Memo<textarea name="memo" rows={2} maxLength={2000} placeholder="Notes, payment method, receipt or Venmo reference…" className={control} /></label>
        <label className="min-w-0 text-sm font-bold">Payment ($)<input name="payment" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" placeholder="Money out" className={control} /></label>
        <label className="min-w-0 text-sm font-bold">Deposit ($)<input name="deposit" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" placeholder="Money in" className={control} /></label>
        <div className="sm:col-span-2 xl:col-span-4"><LedgerSubmit>Post Transaction</LedgerSubmit></div>
      </form>
    </details>
    <div className="mt-6 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto]">
      <label className="min-w-0 text-sm font-bold">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Payee, memo, show…" className={control} /></label>
      <label className="min-w-0 text-sm font-bold">Show<select value={show} onChange={e => setShow(e.target.value)} className={control}><option value="">All shows / whole band</option><option value="none">General band only</option>{shows.map(s => <option key={s.id} value={s.id}>{showLabel(s)}</option>)}</select></label>
      <label className="min-w-0 text-sm font-bold">Category<select value={category} onChange={e => setCategory(e.target.value)} className={control}><option value="">All categories</option>{Object.entries(BAND_LEDGER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="button" onClick={exportCsv} className="min-h-11 rounded-lg border border-stone-600 px-4 py-3 text-sm font-bold">Export Visible CSV</button>
    </div>
    <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} className="h-5 w-5" />Show voided transactions</label>
    <p className="mb-4 text-xs leading-5 text-stone-400">Oldest first; same-day entries follow posting order. Balance is the whole-band running balance, even when filtered. Show choices use the same show list supplied to PF-Com. Sales forecasts, recorded expenses, and pending Venmo orders are not automatically posted to this register.</p>
    <div className="hidden overflow-x-auto rounded-xl border border-stone-700 md:block" role="region" aria-label="Band checking register" tabIndex={0}>
      <table className="w-full min-w-[1440px] table-fixed text-left text-sm">
        <colgroup><col className="w-[110px]" /><col className="w-[170px]" /><col className="w-[140px]" /><col className="w-[220px]" /><col className="w-[280px]" /><col className="w-[150px]" /><col className="w-[150px]" /><col className="w-[180px]" /></colgroup>
        <thead className="bg-stone-900 text-xs uppercase text-stone-400"><tr>{["Date", "Payee", "Category", "Show", "Memo", "Payment", "Deposit", "Balance"].map((h, i) => <th key={h} scope="col" className={"px-4 py-4 " + (i >= 5 ? "text-right" : "")}>{h}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.id} className={"border-t border-stone-800 align-top " + (row.voided_at ? "opacity-60" : "")}>
          <td className="whitespace-nowrap px-4 py-4">{row.entry_date}</td>
          <td className="break-words px-4 py-4 font-bold">{row.payee}{row.voided_at && <span className="mt-2 block text-xs text-stone-400">VOIDED</span>}</td>
          <td className="break-words px-4 py-4">{BAND_LEDGER_CATEGORIES[row.category]}</td>
          <td className="break-words px-4 py-4">{showCell(row)}</td>
          <td className="px-4 py-4"><p className="whitespace-pre-wrap break-words">{row.memo || "—"}</p><VoidEntry row={row} /></td>
          <td className="whitespace-nowrap px-4 py-4 text-right text-red-400">{row.paymentCents ? money(row.paymentCents) : "—"}</td>
          <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-400">{row.depositCents ? money(row.depositCents) : "—"}</td>
          <td className="whitespace-nowrap px-4 py-4 text-right font-black">{money(row.balance)}</td>
        </tr>)}</tbody>
      </table>
      {!visible.length && <p className="p-6 text-stone-400">No matching transactions.</p>}
    </div>
    <div className="space-y-3 md:hidden">{visible.map(row => <article key={row.id} className={"min-w-0 rounded-xl border border-stone-700 bg-stone-900 p-4 " + (row.voided_at ? "opacity-60" : "")}>
      <p className="text-xs text-stone-400">{row.entry_date} · {BAND_LEDGER_CATEGORIES[row.category]}{row.voided_at ? " · VOIDED" : ""}</p>
      <h2 className="mt-2 font-bold">{row.payee}</h2><p className="mt-2 text-sm">{showCell(row)}</p>
      {row.memo && <p className="mt-3 whitespace-pre-wrap text-sm text-stone-400">{row.memo}</p>}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-stone-400">Payment</dt><dd className="mt-1 font-bold text-red-400">{row.paymentCents ? money(row.paymentCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Deposit</dt><dd className="mt-1 font-bold text-emerald-400">{row.depositCents ? money(row.depositCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Balance</dt><dd className="mt-1 font-black">{money(row.balance)}</dd></div></dl>
      <VoidEntry row={row} />
    </article>)}
    {!visible.length && <p className="p-4 text-stone-400">No matching transactions.</p>}</div>
    <p className="mt-4 text-xs leading-5 text-stone-400">Posted transactions retain their original values. To correct one, void it with a reason and post a replacement. A transfer between accounts already included in your band balance is not new income; only enter money crossing the boundary of the account or funds you track here.</p>
  </>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-stone-800 bg-stone-900 p-4"><p className="text-xs text-stone-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}
function VoidEntry({ row }: { row: BandLedgerRow }) {
  if (row.voided_at) return <p className="mt-3 text-xs text-stone-400">Voided: {row.void_reason}</p>;
  return <details className="mt-3"><summary className="cursor-pointer py-2 text-xs font-bold text-stone-500">Void / correct</summary>
    <form action={voidBandLedgerEntry} className="mt-2 space-y-3">
      <input type="hidden" name="entry_id" value={row.id} />
      <label className="block text-xs">Reason<input name="void_reason" maxLength={300} required className={control} /></label>
      <LedgerSubmit>Confirm Void</LedgerSubmit>
    </form>
  </details>;
}
