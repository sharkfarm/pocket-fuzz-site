"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ticketSalesClosed } from "@/lib/ticket-sales";
export default function TicketSalesWindow({ cutoff, initiallyClosed, children }: {
  cutoff: string | null; initiallyClosed: boolean; children: ReactNode;
}) {
  const [closed, setClosed] = useState(initiallyClosed);
  useEffect(() => {
    if (!cutoff) return;
    const update = () => setClosed(ticketSalesClosed(cutoff));
    update();
    const timer = setInterval(update, 1000);
    const remaining = Date.parse(cutoff) - Date.now();
    const deadline = remaining > 0 && remaining <= 2147483647
      ? setTimeout(update, remaining) : undefined;
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); clearTimeout(deadline); window.removeEventListener("focus", update); };
  }, [cutoff]);
  if (closed) return (
    <section role="status" className="mt-10 rounded-2xl border border-stone-700 bg-stone-900 p-5 text-center sm:p-8">
      <h2 className="text-2xl font-black">Online Ticket Sales Closed</h2>
      <p className="mt-3 text-stone-300">Online sales for this show have ended. Contact the venue about door availability.</p>
    </section>
  );
  return children;
}
