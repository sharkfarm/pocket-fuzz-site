"use server";
import { createClient } from "@/lib/supabase/server";
import { parseLedgerEntry } from "@/lib/show-ledger";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function postLedgerEntry(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const showId = String(form.get("show_id") ?? "");
  if (!showId) throw new Error("Show ID is required.");
  const path = "/admin/shows/" + encodeURIComponent(showId);
  const entryId = String(form.get("entry_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId)) {
    redirect(path + "?error=Refresh%20the%20ledger%20before%20posting#bookkeeping");
  }
  let entry;
  try { entry = parseLedgerEntry(form); }
  catch (error) { redirect(path + "?error=" + encodeURIComponent(error instanceof Error ? error.message : "Invalid entry.") + "#bookkeeping"); }
  const { data: show, error: showError } = await supabase.from("shows").select("id").eq("id", showId).single();
  if (showError || !show) redirect(path + "?error=Show%20not%20found#bookkeeping");
  const { error } = await supabase.from("show_ledger_entries").insert({ id: entryId, ...entry, show_id: showId, created_by: user.id });
  if (error?.code === "23505") redirect(path + "?error=This%20entry%20was%20already%20posted.%20Refresh%20before%20adding%20another.#bookkeeping");
  if (error) redirect(path + "?error=" + encodeURIComponent(error.message) + "#bookkeeping");
  revalidatePath(path);
  redirect(path + "?saved=ledger#bookkeeping");
}
export async function voidLedgerEntry(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const showId = String(form.get("show_id") ?? "");
  const entryId = String(form.get("entry_id") ?? "");
  const reason = String(form.get("void_reason") ?? "").trim();
  if (!showId || !entryId) throw new Error("Show and entry IDs are required.");
  const path = "/admin/shows/" + encodeURIComponent(showId);
  if (!reason || reason.length > 300) redirect(path + "?error=Enter%20a%20void%20reason%20up%20to%20300%20characters#bookkeeping");
  const { data, error } = await supabase.from("show_ledger_entries")
    .update({ voided_at: new Date().toISOString(), voided_by: user.id, void_reason: reason })
    .eq("id", entryId).eq("show_id", showId).is("voided_at", null).select("id").single();
  if (error || !data) redirect(path + "?error=" + encodeURIComponent(error?.message ?? "Entry not found or already voided.") + "#bookkeeping");
  revalidatePath(path);
  redirect(path + "?saved=ledger-void#bookkeeping");
}
