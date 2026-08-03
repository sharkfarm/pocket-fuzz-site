"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export async function saveBandMember(formData: FormData) {
  const supabase = await auth();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const split = Number(formData.get("default_split_percent") ?? 0);
  if (!name || !Number.isFinite(split) || split < 0 || split > 100) redirect("/admin/band?error=Enter%20a%20valid%20name%20and%20split");
  const payload = {
    name,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    venmo_handle: String(formData.get("venmo_handle") ?? "").trim() || null,
    instrument: String(formData.get("instrument") ?? "").trim() || null,
    default_split_percent: split,
    active: formData.get("active") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
    sort_order: Number(formData.get("sort_order") ?? 0),
  };
  const query = id ? supabase.from("band_members").update(payload).eq("id", id) : supabase.from("band_members").insert(payload);
  const { error } = await query;
  if (error) redirect(`/admin/band?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/band");
  redirect("/admin/band?saved=member");
}

export async function deleteBandMember(formData: FormData) {
  const supabase = await auth();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("band_members").delete().eq("id", id);
  if (error) redirect(`/admin/band?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/band");
  redirect("/admin/band?saved=deleted");
}
