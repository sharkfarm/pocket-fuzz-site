"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function numeric(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function createShow(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const venueId = String(formData.get("venue_id") ?? "");
  const showDate = String(formData.get("show_date") ?? "");
  const showName = String(formData.get("show_name") ?? "").trim();

  if (!venueId || !showDate) redirect("/admin/shows/new?error=Venue%20and%20date%20are%20required");

  const { data: venue, error: venueError } = await supabase.from("venues").select("name").eq("id", venueId).single();
  if (venueError || !venue) redirect(`/admin/shows/new?error=${encodeURIComponent(venueError?.message ?? "Venue not found")}`);

  const rawSlug = String(formData.get("public_slug") ?? "").trim();
  const publicSlug = slugify(rawSlug || `${venue.name}-${showDate}`);

  const { data: show, error: showError } = await supabase.from("shows").insert({
    venue_id: venueId,
    show_name: showName || `Pocket Fuzz at ${venue.name}`,
    show_date: showDate,
    doors_time: String(formData.get("doors_time") ?? "19:00") || null,
    start_time: String(formData.get("start_time") ?? "20:00") || null,
    end_time: String(formData.get("end_time") ?? "00:00") || null,
    capacity: numeric(formData, "capacity", 300),
    ticket_goal: numeric(formData, "ticket_goal", 50),
    number_of_acts: numeric(formData, "number_of_acts", 3),
    radius_clause_weeks: numeric(formData, "radius_clause_weeks", 4),
    radius_clause_miles: numeric(formData, "radius_clause_miles", 20),
    food_discount_percent: numeric(formData, "food_discount_percent", 40),
    meals_included_ticket_threshold: numeric(formData, "meals_included_ticket_threshold", 50),
    is_public: formData.get("is_public") === "on",
    featured: formData.get("featured") === "on",
    public_slug: publicSlug || null,
    public_description: String(formData.get("public_description") ?? "").trim() || null,
    flyer_url: String(formData.get("flyer_url") ?? "").trim() || null,
    created_by: user.id,
  }).select("id").single();

  if (showError || !show) redirect(`/admin/shows/new?error=${encodeURIComponent(showError?.message ?? "Could not create show")}`);

  const ticketRows = [
    { ticket_type: "Offline Presale", channel: "offline", ticket_price: numeric(formData, "offline_price", 12) },
    { ticket_type: "Online", channel: "online", ticket_price: numeric(formData, "online_price", 12) },
    { ticket_type: "Door", channel: "door", ticket_price: numeric(formData, "door_price", 15) },
    { ticket_type: "Reserved Table", channel: "reserved", ticket_price: numeric(formData, "reserved_price", 18) },
  ].map((row) => ({ ...row, show_id: show.id }));

  const { error: ticketError } = await supabase.from("ticket_sales").insert(ticketRows);
  if (ticketError) {
    await supabase.from("shows").delete().eq("id", show.id);
    redirect(`/admin/shows/new?error=${encodeURIComponent(ticketError.message)}`);
  }

  const { data: members } = await supabase.from("band_members").select("name,default_split_percent").eq("active", true).order("sort_order");
  if ((members ?? []).length > 0) {
    const payoutRows = (members ?? []).map((member) => ({
      show_id: show.id,
      member_name: member.name,
      payout_percent: Number(member.default_split_percent),
      payout_amount: 0,
      paid: false,
    }));
    const { error: payoutError } = await supabase.from("show_payments").insert(payoutRows);
    if (payoutError) redirect(`/admin/shows/${show.id}?error=${encodeURIComponent(payoutError.message)}`);
  }

  revalidatePath("/admin/shows");
  revalidatePath("/shows");
  redirect(`/admin/shows/${show.id}`);
}
