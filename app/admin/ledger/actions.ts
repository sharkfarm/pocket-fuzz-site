"use server";
import { importApprovedVenmoDeposits } from "@/lib/venmo-ledger-import";
import { createClient } from "@/lib/supabase/server";
import { BAND_LEDGER_CATEGORIES, parseBandLedgerEntry, showLabel } from "@/lib/band-ledger";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
const path = "/admin/ledger";
function fail(message: string): never { redirect(path + "?error=" + encodeURIComponent(message)); }

export async function postBandLedgerEntry(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const id = String(form.get("entry_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) fail("Refresh the ledger before posting.");
  let entry;
  try { entry = parseBandLedgerEntry(form); }
  catch (error) { fail(error instanceof Error ? error.message : "Invalid transaction."); }
  let show_label: string | null = null;
  if (entry.show_id) {
    const { data: show, error } = await db.from("shows").select("id,show_name,show_date").eq("id", entry.show_id).single();
    if (error || !show) fail("The selected show is no longer available. Choose a show from the list.");
    show_label = showLabel(show);
  }
  const { error } = await db.from("band_ledger_entries").insert({ ...entry, id, show_label, created_by: user.id });
  if (error?.code === "23505") fail("This transaction was already posted. Refresh before adding another.");
  if (error) fail(error.message);
  revalidatePath(path);
  redirect(path + "?saved=posted");
}
export async function voidBandLedgerEntry(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const id = String(form.get("entry_id") ?? "");
  const reason = String(form.get("void_reason") ?? "").trim();
  if (!id || !reason || reason.length > 300) fail("Enter a void reason of 1–300 characters.");
  const { data, error } = await db.from("band_ledger_entries")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id, void_reason: reason })
    .eq("id", id).is("voided_at", null).select("id").single();
  if (error || !data) fail(error?.message ?? "Transaction not found or already voided.");
  revalidatePath(path);
  redirect(path + "?saved=voided");
}

export async function importApprovedVenmoOrders() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  let result;
  try { result = await importApprovedVenmoDeposits(db, user.id); }
  catch (error) { fail(error instanceof Error ? error.message : "Venmo import failed."); }
  const total = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(result.depositCents / 100);
  const notice = "Imported " + result.imported + " Venmo deposits totaling " + total +
    ". " + result.skipped + " previously imported orders skipped." +
    (result.zeroAmount ? " " + result.zeroAmount + " zero-dollar orders excluded." : "");
  revalidatePath(path);
  redirect(path + "?saved=venmo-import&notice=" + encodeURIComponent(notice));
}

export async function updateBandLedgerCategory(form: FormData): Promise<{ error: string | null }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const id = String(form.get("entry_id") ?? "");
  const category = String(form.get("category") ?? "");
  const previous = String(form.get("previous_category") ?? "");
  if (!id || !Object.hasOwn(BAND_LEDGER_CATEGORIES, category) || !Object.hasOwn(BAND_LEDGER_CATEGORIES, previous)) {
    return { error: "Choose a valid category." };
  }
  if (category === previous) return { error: null };
  const { data, error } = await db.from("band_ledger_entries").update({ category })
    .eq("id", id).eq("category", previous).is("voided_at", null).select("id,category").single();
  if (error || !data) return { error: error?.message || "The entry changed or was voided. Refresh and try again." };
  if (data.category !== category) return { error: "The database did not retain the category. Apply supabase/07-ledger-category-editing.sql." };
  revalidatePath(path);
  return { error: null };
}
