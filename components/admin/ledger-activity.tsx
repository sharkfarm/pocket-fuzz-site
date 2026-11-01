"use client";
import { useState } from "react";
import Link from "next/link";
import { ledgerCsv, type LedgerRow } from "@/lib/show-ledger";
import { voidLedgerEntry } from "@/app/admin/shows/[id]/ledger/actions";
import LedgerSubmit from "./ledger-submit";

type Row = LedgerRow & { balance: number };
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
export default function LedgerActivity({ rows, showId }: { rows: Row[]; showId: string }) {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [showVoided, setShowVoided] = useState(false);
  const visible = rows.filter(row => (showVoided || !row.voided) &&
    (direction === "all" || row.direction === direction) &&
    [row.description, row.account, row.reference, row.category].join(" ").toLowerCase().includes(search.toLowerCase()));
  function download() {
    const url = URL.createObjectURL(new Blob([ledgerCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "show-" + showId + "-ledger.csv"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="mt-6">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Search entries<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, account, reference…" className="mt-2 block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-3" /></label>
      <label className="text-sm">Movement<select value={direction} onChange={e => setDirection(e.target.value)} className="mt-2 block rounded-lg border border-stone-700 bg-stone-950 px-3 py-3"><option value="all">All</option><option value="in">Receipts</option><option value="out">Outgoings</option><option value="transfer">Transfers</option></select></label>
      <button type="button" onClick={download} className="min-h-11 rounded-lg border border-stone-600 px-4 py-3 text-sm font-bold">Export Visible CSV</button>
    </div>
    <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} className="h-5 w-5" />Show voided entries</label>
    <p className="mb-3 text-xs text-stone-400">Oldest first. Running net includes all posted entries, even when filtered. Source entries update when their show records change; manual entries retain their original values and can be voided with a reason.</p>
    <div className="space-y-3">
      {visible.map(row => <article key={row.id} className={"min-w-0 rounded-xl border border-stone-700 bg-stone-950 p-4 " + (row.voided ? "opacity-60" : "")}>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-xs text-stone-400">{row.date} · {row.category} · {row.source === "manual" ? "Manual" : "Linked source"}{row.voided ? " · VOIDED" : ""}</p>
            <p className="mt-2 font-bold">{row.description}</p>
            <p className="mt-1 text-sm text-stone-400">{row.account}{row.reference ? " · " + row.reference : ""}</p>
            {row.notes && <p className="mt-2 text-xs leading-5 text-stone-400">{row.notes}</p>}
          </div>
          <div className="sm:text-right"><p className={"text-xl font-black " + (row.direction === "in" ? "text-emerald-400" : row.direction === "out" ? "text-red-400" : "text-stone-200")}>{row.direction === "in" ? "+" : row.direction === "out" ? "−" : "↔ "}{money(row.cents)}</p><p className="mt-2 text-xs text-stone-400">Running net {money(row.balance)}</p></div>
        </div>
        {row.href && <Link href={row.href} className="mt-3 inline-block py-2 text-sm font-bold text-red-400">Open Source Section →</Link>}
        {row.source === "manual" && !row.voided && <details className="mt-3 border-t border-stone-800 pt-3">
          <summary className="cursor-pointer py-2 text-sm font-bold text-stone-400">Void this entry</summary>
          <form action={voidLedgerEntry} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="show_id" value={showId} /><input type="hidden" name="entry_id" value={row.id.slice("manual:".length)} />
            <label className="min-w-0 flex-1 text-sm">Reason (kept in history)<input name="void_reason" maxLength={300} required className="mt-2 block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-900 px-3 py-3" /></label>
            <LedgerSubmit>Confirm Void</LedgerSubmit>
          </form>
        </details>}
      </article>)}
      {!visible.length && <p className="rounded-lg border border-stone-800 p-5 text-stone-400">No matching ledger entries.</p>}
    </div>
  </div>;
}
