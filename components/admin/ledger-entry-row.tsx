"use client";
import { useActionState, useState } from "react";
import { BAND_LEDGER_CATEGORIES, showLabel, type LedgerShow } from "@/lib/band-ledger";
import { postBandLedgerEntry } from "@/app/admin/ledger/actions";

const field = "h-8 w-full min-w-0 rounded border border-stone-700 bg-stone-950 px-2 text-xs";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export default function LedgerEntryRow({ shows, initialShow, entryId, today, balance }: {
  shows: LedgerShow[]; initialShow: string; entryId: string; today: string; balance: number;
}) {
  const [, action, pending] = useActionState(async (_: null, data: FormData) => {
    await postBandLedgerEntry(data); return null;
  }, null);
  const [payment, setPayment] = useState("");
  const [deposit, setDeposit] = useState("");
  const paymentValue = Number(payment || 0);
  const depositValue = Number(deposit || 0);
  const validAmount = Number.isFinite(paymentValue) && Number.isFinite(depositValue) &&
    paymentValue >= 0 && depositValue >= 0 && ((paymentValue > 0) !== (depositValue > 0));
  const projectedBalance = balance + (validAmount ? Math.round(depositValue * 100) - Math.round(paymentValue * 100) : 0);
  const formId = "ledger-new-" + entryId;
  return <tr aria-label="New ledger transaction" className="h-11 border-t-2 border-stone-600 bg-stone-900 align-middle">
    <td className="px-2 py-1.5">
      <form id={formId} action={action}><input type="hidden" name="entry_id" value={entryId} /></form>
      <input form={formId} aria-label="New transaction date" name="entry_date" type="date" defaultValue={today} required className={field} />
    </td>
    <td className="px-2 py-1.5"><input form={formId} aria-label="New transaction payee" name="payee" maxLength={300} placeholder="Payee" required className={field} /></td>
    <td className="px-2 py-1.5"><select form={formId} aria-label="New transaction category" name="category" defaultValue="" required className={field}>
      <option value="" disabled>Category…</option>{Object.entries(BAND_LEDGER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></td>
    <td className="px-2 py-1.5"><select form={formId} aria-label="New transaction show" name="show_id" defaultValue={shows.some(s => s.id === initialShow) ? initialShow : ""} className={field}>
      <option value="">No show / general band</option>{shows.map(s => <option key={s.id} value={s.id}>{showLabel(s)}</option>)}
    </select></td>
    <td className="px-2 py-1.5"><input form={formId} aria-label="New transaction memo" name="memo" maxLength={2000} placeholder="Memo / notes" className={field} /></td>
    <td className="px-2 py-1.5"><input form={formId} aria-label="New transaction payment" name="payment" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" placeholder="Payment" value={payment} onChange={e => setPayment(e.target.value)} className={field + " text-right"} /></td>
    <td className="px-2 py-1.5"><input form={formId} aria-label="New transaction deposit" name="deposit" type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" placeholder="Deposit" value={deposit} onChange={e => setDeposit(e.target.value)} className={field + " text-right"} /></td>
    <td className="px-2 py-1.5"><div className="flex items-center justify-end gap-2">
      <span title="Balance after this transaction" className="whitespace-nowrap text-xs font-bold">{money(projectedBalance)}</span>
      <button form={formId} type="submit" disabled={pending} className="h-8 shrink-0 rounded bg-red-600 px-2 text-xs font-bold disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    </div></td>
  </tr>;
}
