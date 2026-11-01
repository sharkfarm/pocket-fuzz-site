import type { SupabaseClient } from "@supabase/supabase-js";
import type { BandLedgerCategory } from "./band-ledger";

export type ApprovedVenmoOrder = {
  id: string; order_number: string; customer_name: string | null; venmo_username: string | null;
  expected_amount: number | string; service_fee: number | string | null; status: string;
  submitted_at: string | null; reviewed_at: string | null; created_at: string; show_id: string | null;
  shows: { show_name: string | null; show_date: string } | { show_name: string | null; show_date: string }[] | null;
  venmo_order_items: { item_kind: string; item_name: string; item_option: string | null; quantity: number }[] | null;
};
export function venmoLedgerDeposit(order: ApprovedVenmoOrder, actorId: string) {
  if (order.status !== "approved") throw new Error("Only approved Venmo orders can be imported.");
  const amount = Number(order.expected_amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount on Venmo order " + order.order_number);
  if (amount === 0) return null; // No money moved; the register requires a positive amount.
  const timestamp = order.submitted_at || order.reviewed_at || order.created_at;
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Invalid payment date on Venmo order " + order.order_number);
  const entry_date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
  const show = Array.isArray(order.shows) ? order.shows[0] : order.shows;
  const items = order.venmo_order_items ?? [];
  const category: BandLedgerCategory = items.length && items.every(i => i.item_kind === "ticket") ? "ticket_sales"
    : items.length && items.every(i => i.item_kind === "merch") ? "merch_sales" : "venmo";
  const memo = [
    "Venmo order " + order.order_number,
    order.venmo_username ? "@" + order.venmo_username.replace(/^@+/, "") : "",
    items.map(i => i.quantity + " × " + i.item_name + (i.item_option ? " (" + i.item_option + ")" : "")).join(", "),
    "Gross receipt; includes $" + Number(order.service_fee ?? 0).toFixed(2) + " customer service fee. Actual processor fees are not deducted.",
  ].filter(Boolean).join(" · ").slice(0, 2000);
  return {
    // Reserve the source order UUID as the ledger entry UUID. The existing
    // primary key makes retries/concurrent imports idempotent, even after voids.
    id: order.id, entry_date, payee: (order.customer_name?.trim() || order.venmo_username?.trim() || "Venmo customer").slice(0, 300),
    category, show_id: order.show_id,
    show_label: show ? show.show_date + " · " + (show.show_name || "Pocket Fuzz show") : null,
    memo, payment: 0, deposit: amount, created_by: actorId,
  };
}

export async function importApprovedVenmoDeposits(db: SupabaseClient, actorId: string, dryRun = false) {
  const orders: ApprovedVenmoOrder[] = [];
  const pageSize = 100;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db.from("venmo_orders")
      .select("id,order_number,customer_name,venmo_username,expected_amount,service_fee,status,submitted_at,reviewed_at,created_at,show_id,shows(show_name,show_date),venmo_order_items(item_kind,item_name,item_option,quantity)")
      .eq("status", "approved").order("created_at").order("id").range(start, start + pageSize - 1);
    if (error) throw new Error(error.message);
    orders.push(...(data ?? []) as unknown as ApprovedVenmoOrder[]);
    if ((data?.length ?? 0) < pageSize) break;
  }
  // Validate all source rows before the first write.
  const deposits = orders.map(o => venmoLedgerDeposit(o, actorId)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  deposits.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.id.localeCompare(b.id));
  let imported = 0; let skipped = 0; let depositCents = 0;
  for (let start = 0; start < deposits.length; start += pageSize) {
    const batch = deposits.slice(start, start + pageSize);
    if (dryRun) {
      const { data, error } = await db.from("band_ledger_entries").select("id").in("id", batch.map(row => row.id));
      if (error) throw new Error(error.message);
      const existing = new Set((data ?? []).map(row => row.id));
      const pending = batch.filter(row => !existing.has(row.id));
      imported += pending.length; skipped += batch.length - pending.length;
      depositCents += pending.reduce((sum, row) => sum + Math.round(row.deposit * 100), 0);
    } else {
      const { data, error } = await db.from("band_ledger_entries")
        .upsert(batch, { onConflict: "id", ignoreDuplicates: true }).select("id,deposit");
      if (error) throw new Error("Venmo import stopped after " + imported + " new deposits. Rerun safely to continue. " + error.message);
      imported += (data?.length ?? 0); skipped += batch.length - (data?.length ?? 0);
      depositCents += (data ?? []).reduce((sum, row) => sum + Math.round(Number(row.deposit) * 100), 0);
    }
  }
  return { approved: orders.length, imported, skipped, zeroAmount: orders.length - deposits.length, depositCents };
}
