"use client";

import { useMemo, useState } from "react";

type Ticket = { ticket_type: string; ticket_price: number | string; actual_quantity: number };

export default function LiveTicketCalculator({ tickets, capacity }: { tickets: Ticket[]; capacity: number }) {
  const [rows, setRows] = useState(() => tickets.map((ticket) => ({ ...ticket, ticket_price: Number(ticket.ticket_price), actual_quantity: Number(ticket.actual_quantity) })));
  const result = useMemo(() => {
    const sold = rows.reduce((sum, row) => sum + row.actual_quantity, 0);
    const gross = rows.reduce((sum, row) => sum + row.actual_quantity * row.ticket_price, 0);
    const rate = sold >= 50 ? .7 : sold >= 30 ? .6 : sold >= 10 ? .5 : 0;
    const next = sold < 10 ? 10 : sold < 30 ? 30 : sold < 50 ? 50 : null;
    return { sold, gross, rate, payout: gross * rate, next, remaining: next ? next - sold : 0 };
  }, [rows]);

  return (
    <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-xl font-black uppercase">Live Payout Calculator</h2><p className="mt-1 text-sm text-stone-400">Try ticket quantities without saving them.</p></div>
        <p className="text-sm text-stone-500">Capacity {capacity}</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row, index) => (
          <label key={`${row.ticket_type}-${index}`} className="rounded-xl border border-stone-800 bg-stone-950 p-4">
            <span className="text-xs font-bold uppercase text-stone-500">{row.ticket_type}</span>
            <div className="mt-3 flex gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-stone-700 px-3"><span className="text-stone-500">$</span><input type="number" min="0" step=".01" value={row.ticket_price} onChange={(e) => setRows((current) => current.map((item,i) => i === index ? {...item, ticket_price:Number(e.target.value)} : item))} className="w-full bg-transparent p-2 outline-none" /></div>
              <input type="number" min="0" step="1" value={row.actual_quantity} onChange={(e) => setRows((current) => current.map((item,i) => i === index ? {...item, actual_quantity:Number(e.target.value)} : item))} className="w-24 rounded-lg border border-stone-700 bg-transparent p-2 outline-none" aria-label={`${row.ticket_type} quantity`} />
            </div>
          </label>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Tickets" value={`${result.sold} / ${capacity}`} />
        <Metric label="Gross" value={money(result.gross)} />
        <Metric label="Tier" value={`${Math.round(result.rate * 100)}%`} />
        <Metric label="Payout" value={money(result.payout)} accent />
        <Metric label="Next Tier" value={result.next ? `${result.remaining} more` : "Highest tier"} />
      </div>
    </section>
  );
}

function Metric({ label, value, accent = false }: { label:string; value:string; accent?:boolean }) { return <div className="rounded-xl border border-stone-800 bg-stone-950 p-4"><p className="text-xs font-bold uppercase text-stone-500">{label}</p><p className={`mt-2 text-xl font-black ${accent ? "text-red-400" : ""}`}>{value}</p></div>; }
function money(value:number) { return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(value || 0); }
