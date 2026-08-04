"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

function numberValue(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a valid nonnegative number.`);
  }
  return value;
}

async function getSupabase() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export async function createVenue(formData: FormData) {
  const supabase = await getSupabase();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin/venues?error=Venue%20name%20is%20required");

  let defaultCapacity: number | null;
  let typicalPayout: number | null;
  try {
    defaultCapacity = numberValue(formData, "default_capacity");
    typicalPayout = numberValue(formData, "typical_payout");
  } catch (error) {
    redirect(`/admin/venues?error=${encodeURIComponent(error instanceof Error ? error.message : "Invalid values")}`);
  }

  const { error } = await supabase.from("venues").insert({
    name,
    address: text(formData, "address"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postal_code: text(formData, "postal_code"),
    website: text(formData, "website"),
    booking_email: text(formData, "booking_email"),
    phone: text(formData, "phone"),
    contact_name: text(formData, "contact_name"),
    default_capacity: defaultCapacity,
    typical_payout: typicalPayout,
    indoor_outdoor: text(formData, "indoor_outdoor"),
    food_terms: text(formData, "food_terms"),
    drink_terms: text(formData, "drink_terms"),
    sound_system: text(formData, "sound_system"),
    lighting: text(formData, "lighting"),
    stage_notes: text(formData, "stage_notes"),
    parking_notes: text(formData, "parking_notes"),
    load_in_notes: text(formData, "load_in_notes"),
    booking_notes: text(formData, "booking_notes"),
    rating: numberValue(formData, "rating"),
    favorite: formData.get("favorite") === "on",
    active: true,
    updated_at: new Date().toISOString(),
  });

  if (error) redirect(`/admin/venues?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/venues");
  revalidatePath("/admin/shows/new");
  redirect("/admin/venues?saved=created");
}

export async function updateVenue(formData: FormData) {
  const supabase = await getSupabase();
  const venueId = String(formData.get("venue_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!venueId || !name) redirect("/admin/venues?error=Venue%20ID%20and%20name%20are%20required");

  let defaultCapacity: number | null;
  let typicalPayout: number | null;
  try {
    defaultCapacity = numberValue(formData, "default_capacity");
    typicalPayout = numberValue(formData, "typical_payout");
  } catch (error) {
    redirect(`/admin/venues?error=${encodeURIComponent(error instanceof Error ? error.message : "Invalid values")}`);
  }

  const { error } = await supabase.from("venues").update({
    name,
    address: text(formData, "address"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    postal_code: text(formData, "postal_code"),
    website: text(formData, "website"),
    booking_email: text(formData, "booking_email"),
    phone: text(formData, "phone"),
    contact_name: text(formData, "contact_name"),
    default_capacity: defaultCapacity,
    typical_payout: typicalPayout,
    indoor_outdoor: text(formData, "indoor_outdoor"),
    food_terms: text(formData, "food_terms"),
    drink_terms: text(formData, "drink_terms"),
    sound_system: text(formData, "sound_system"),
    lighting: text(formData, "lighting"),
    stage_notes: text(formData, "stage_notes"),
    parking_notes: text(formData, "parking_notes"),
    load_in_notes: text(formData, "load_in_notes"),
    booking_notes: text(formData, "booking_notes"),
    rating: numberValue(formData, "rating"),
    favorite: formData.get("favorite") === "on",
    active: formData.get("active") === "on",
    updated_at: new Date().toISOString(),
  }).eq("id", venueId);

  if (error) redirect(`/admin/venues?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/venues");
  revalidatePath("/admin/shows");
  revalidatePath("/admin/shows/new");
  revalidatePath("/shows");
  revalidatePath("/");
  redirect("/admin/venues?saved=updated");
}

export async function deleteVenue(formData: FormData) {
  const supabase = await getSupabase();
  const venueId = String(formData.get("venue_id") ?? "");
  if (!venueId) redirect("/admin/venues?error=Venue%20ID%20is%20required");

  const { count, error: countError } = await supabase
    .from("shows")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);

  if (countError) redirect(`/admin/venues?error=${encodeURIComponent(countError.message)}`);
  if ((count ?? 0) > 0) {
    redirect("/admin/venues?error=This%20venue%20is%20used%20by%20a%20show.%20Mark%20it%20inactive%20instead.");
  }

  const { error } = await supabase.from("venues").delete().eq("id", venueId);
  if (error) redirect(`/admin/venues?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/venues");
  revalidatePath("/admin/shows/new");
  redirect("/admin/venues?saved=deleted");
}
