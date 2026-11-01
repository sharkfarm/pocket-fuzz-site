"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { BAND_LEDGER_CATEGORIES, bandLedgerCsv, showLabel, type BandLedgerRow, type LedgerShow, type bandLedgerRegister } from "@/lib/band-ledger";
import { postBandLedgerEntry, voidBandLedgerEntry, importApprovedVenmoOrders } from "@/app/admin/ledger/actions";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const memoDialog = useRef<HTMLDialogElement>(null);
  const selectedRow = register.rows.find(row => row.id === selectedId);
  function expandMemo(row: BandLedgerRow) {
    setSelectedId(row.id);
    memoDialog.current?.showModal();
  }
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
    <section className="mt-6 rounded-xl border border-stone-700 bg-stone-900 p-4 sm:p-5">
      <h2 className="font-black uppercase">Import Approved Venmo Payments</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-stone-400">Add all approved Venmo orders as deposits, including orders without a show. Each order is imported once; running this again skips existing imports, including voided ones. Pending and declined orders are excluded. Deposits use gross receipt amounts including customer service fees; record actual processor fees separately.</p>
      <p className="mt-2 text-xs leading-5 text-stone-400">Dates use customer payment confirmation in Mountain Time, falling back to approval or order creation. Avoid manually entering the same Venmo receipt before importing.</p>
      <form action={importApprovedVenmoOrders} className="mt-4"><LedgerSubmit>Import Approved Venmo Payments</LedgerSubmit></form>
    </section>
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
        <thead className="bg-stone-900 text-xs uppercase text-stone-400"><tr>{["Date", "Payee", "Category", "Show", "Memo", "Payment", "Deposit", "Balance"].map((h, i) => <th key={h} scope="col" className={"px-3 py-2.5 " + (i >= 5 ? "text-right" : "")}>{h}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.id} className={"h-10 border-t border-stone-800 align-middle " + (row.voided_at ? "opacity-60" : "")}>
          <td className="whitespace-nowrap px-3 py-1.5 leading-5">{row.entry_date}</td>
          <td className="px-3 py-1.5 leading-5"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-bold" title={row.payee}>{row.payee}</span>{row.voided_at && <span className="shrink-0 text-[10px] text-stone-400">VOIDED</span>}</div></td>
          <td className="px-3 py-1.5 leading-5"><div className="truncate" title={BAND_LEDGER_CATEGORIES[row.category]}>{BAND_LEDGER_CATEGORIES[row.category]}</div></td>
          <td className="px-3 py-1.5 leading-5"><div className="truncate" title={row.showName}>{showCell(row)}</div></td>
          <td className="px-3 py-1.5 leading-5">
            <button type="button" onClick={() => expandMemo(row)} aria-haspopup="dialog" aria-label={"Expand memo and transaction details for " + row.payee + " on " + row.entry_date} className="flex h-7 w-full min-w-0 items-center gap-2 text-left">
              <span className="min-w-0 flex-1 truncate text-stone-400">{row.memo || "—"}</span><span className="shrink-0 text-xs font-bold text-red-400">Expand</span>
            </button>
          </td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right leading-5 text-red-400">{row.paymentCents ? money(row.paymentCents) : "—"}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right leading-5 text-emerald-400">{row.depositCents ? money(row.depositCents) : "—"}</td>
          <td className="whitespace-nowrap px-3 py-1.5 text-right font-black leading-5">{money(row.balance)}</td>
        </tr>)}</tbody>
      </table>
      {!visible.length && <p className="p-6 text-stone-400">No matching transactions.</p>}
    </div>
    <div className="space-y-3 md:hidden">{visible.map(row => <article key={row.id} className={"min-w-0 rounded-xl border border-stone-700 bg-stone-900 p-4 " + (row.voided_at ? "opacity-60" : "")}>
      <p className="text-xs text-stone-400">{row.entry_date} · {BAND_LEDGER_CATEGORIES[row.category]}{row.voided_at ? " · VOIDED" : ""}</p>
      <h2 className="mt-2 font-bold">{row.payee}</h2><p className="mt-2 text-sm">{showCell(row)}</p>
      <button type="button" onClick={() => expandMemo(row)} aria-haspopup="dialog" className="mt-2 flex min-h-11 w-full min-w-0 items-center gap-2 text-left text-sm"><span className="min-w-0 flex-1 truncate text-stone-400">{row.memo || "Transaction details"}</span><span className="shrink-0 font-bold text-red-400">Expand</span></button>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-stone-400">Payment</dt><dd className="mt-1 font-bold text-red-400">{row.paymentCents ? money(row.paymentCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Deposit</dt><dd className="mt-1 font-bold text-emerald-400">{row.depositCents ? money(row.depositCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Balance</dt><dd className="mt-1 font-black">{money(row.balance)}</dd></div></dl>
    </article>)}
    {!visible.length && <p className="p-4 text-stone-400">No matching transactions.</p>}</div>
    <dialog ref={memoDialog} onClose={() => setSelectedId(null)} aria-labelledby="ledger-memo-title" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-stone-700 bg-stone-900 p-5 text-stone-100 shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-4">
        <h2 id="ledger-memo-title" className="text-lg font-black">Memo & Transaction Details</h2>
        <button type="button" onClick={() => memoDialog.current?.close()} className="min-h-11 rounded-lg border border-stone-600 px-4 py-2 text-sm font-bold">Close</button>
      </div>
      {selectedRow && <>
        <p className="mt-4 font-bold">{selectedRow.payee}</p>
        <p className="mt-1 text-sm text-stone-400">{selectedRow.entry_date} · {BAND_LEDGER_CATEGORIES[selectedRow.category]}</p>
        {selectedRow.showName && <p className="mt-2 text-sm">{showCell(selectedRow)}</p>}
        <p className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-stone-950 p-4 text-sm leading-6">{selectedRow.memo || "No memo recorded."}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-xs text-stone-400">Payment</dt><dd className="mt-1 font-bold">{selectedRow.paymentCents ? money(selectedRow.paymentCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Deposit</dt><dd className="mt-1 font-bold">{selectedRow.depositCents ? money(selectedRow.depositCents) : "—"}</dd></div><div><dt className="text-xs text-stone-400">Balance</dt><dd className="mt-1 font-black">{money(selectedRow.balance)}</dd></div></dl>
        <VoidEntry row={selectedRow} />
      </>}
    </dialog>
    <p className="mt-4 text-xs leading-5 text-stone-400">Posted transactions retain their original values. To correct one, expand its memo, void it with a reason, and post a replacement. A transfer between accounts already included in your band balance is not new income; only enter money crossing the boundary of the account or funds you track here.</p>
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
