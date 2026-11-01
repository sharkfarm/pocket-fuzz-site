type Ticket = {
  id: string; ticket_type: string; channel: string; ticket_price: number | string;
  projected_quantity: number; actual_quantity: number; venmo_service_fee: boolean;
  include_in_presale_payout: boolean; ticket_mode: "standard" | "external";
  external_url: string | null; public_note: string | null;
};
const control = "block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-3";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function ShowTicketEditor({ tickets }: { tickets: Ticket[] }) {
  return <div className="space-y-4 p-4 sm:p-6">
    {tickets.map((ticket) => {
      const external = ticket.ticket_mode === "external";
      return <article key={ticket.id} className="min-w-0 rounded-xl border border-stone-700 bg-stone-950/40 p-4 sm:p-5">
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <input type="hidden" name={"ticket_mode_" + ticket.id} value={ticket.ticket_mode ?? "standard"} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-stone-400">{external ? "Venue / external ticket link" : "Pocket Fuzz ticket"}</p>
          <button type="submit" form={"delete-ticket-" + ticket.id} className="min-h-11 rounded-lg border border-red-900 px-4 py-2 text-sm font-bold text-red-400">Delete Ticket Type</button>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold">Ticket type
            <input name={"ticket_type_" + ticket.id} defaultValue={ticket.ticket_type} required className={control + " mt-2"} />
          </label>
          <label className="min-w-0 text-sm font-semibold">Channel
            <select name={"ticket_channel_" + ticket.id} defaultValue={ticket.channel} className={control + " mt-2"} required>
              <option value="online">Online</option><option value="offline">Offline</option><option value="door">Door</option><option value="reserved">Reserved</option>
            </select>
          </label>
        </div>
        {external ? <div className="mt-4 grid min-w-0 gap-4">
          <label className="min-w-0 text-sm font-semibold">External ticket URL
            <input name={"external_url_" + ticket.id} type="url" defaultValue={ticket.external_url ?? ""} required className={control + " mt-2"} />
          </label>
          <label className="min-w-0 text-sm font-semibold">Public note
            <textarea name={"public_note_" + ticket.id} defaultValue={ticket.public_note ?? ""} rows={3} className={control + " mt-2 resize-y whitespace-pre-wrap"} />
          </label>
          <p className="text-sm text-stone-400">Sold by the venue or promoter. Excluded from Pocket Fuzz ticket quantities, revenue, and payout calculations.</p>
        </div> : <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0 text-sm font-semibold">Price ($)
              <input name={"ticket_price_" + ticket.id} type="number" min="0" step="0.01" defaultValue={Number(ticket.ticket_price).toFixed(2)} required className={control + " mt-2"} />
            </label>
            <label className="min-w-0 text-sm font-semibold">Projected tickets
              <input name={"projected_quantity_" + ticket.id} type="number" min="0" step="1" defaultValue={ticket.projected_quantity} required className={control + " mt-2"} />
            </label>
            <label className="min-w-0 text-sm font-semibold">Actual sold
              <input name={"actual_quantity_" + ticket.id} type="number" min="0" step="1" defaultValue={ticket.actual_quantity} required className={control + " mt-2"} />
            </label>
            <div className="rounded-lg border border-stone-800 p-3"><p className="text-sm text-stone-400">Recorded revenue</p><p className="mt-2 text-xl font-black">{money(Number(ticket.ticket_price) * ticket.actual_quantity)}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-stone-800 px-4 py-3 text-sm"><input type="checkbox" name={"include_in_presale_payout_" + ticket.id} defaultChecked={ticket.include_in_presale_payout !== false} className="h-5 w-5 shrink-0" />Include in presale payout</label>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-stone-800 px-4 py-3 text-sm"><input type="checkbox" name={"venmo_service_fee_" + ticket.id} defaultChecked={Boolean(ticket.venmo_service_fee)} className="h-5 w-5 shrink-0" />Charge Venmo service fee</label>
          </div>
        </>}
      </article>;
    })}
    {!tickets.length && <p className="text-stone-400">No ticket types yet. Add one below.</p>}
    <div className="flex flex-wrap justify-between gap-4 rounded-xl border border-stone-800 p-4 font-bold">
      <span>Actual totals (Pocket Fuzz tickets)</span>
      <span>{tickets.filter(t => t.ticket_mode !== "external").reduce((sum, t) => sum + Number(t.actual_quantity), 0)} tickets</span>
      <span>{money(tickets.filter(t => t.ticket_mode !== "external").reduce((sum, t) => sum + Number(t.ticket_price) * Number(t.actual_quantity), 0))}</span>
    </div>
  </div>;
}
