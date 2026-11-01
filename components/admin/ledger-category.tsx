"use client";
import { useState, useTransition } from "react";
import { BAND_LEDGER_CATEGORIES, type BandLedgerRow } from "@/lib/band-ledger";
import { updateBandLedgerCategory } from "@/app/admin/ledger/actions";

export default function LedgerCategory({ row, onError }: { row: BandLedgerRow; onError: (message: string) => void }) {
  const [value, setValue] = useState(row.category);
  const [pending, startTransition] = useTransition();
  if (row.voided_at) return <span className="block truncate">{BAND_LEDGER_CATEGORIES[row.category]}</span>;
  return <select aria-label={"Category for " + row.payee + " on " + row.entry_date} title={pending ? "Saving category…" : "Change category"}
    value={value} disabled={pending}
    onChange={event => {
      const previous = value;
      const next = event.target.value as typeof value;
      setValue(next);
      onError("");
      const form = new FormData();
      form.set("entry_id", row.id); form.set("previous_category", previous); form.set("category", next);
      startTransition(async () => {
        try {
          const result = await updateBandLedgerCategory(form);
          if (result.error) { setValue(previous); onError(result.error); }
        } catch { setValue(previous); onError("Category could not be saved. Refresh and try again."); }
      });
    }}
    className="h-7 w-full min-w-0 rounded border border-transparent bg-stone-950 text-xs hover:border-stone-600 focus:border-red-500 disabled:opacity-50">
    {Object.entries(BAND_LEDGER_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </select>;
}
