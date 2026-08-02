"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createShow(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const showName = String(formData.get("show_name") ?? "").trim();
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const showDate = String(formData.get("show_date") ?? "");
  const capacity = Number(formData.get("capacity") ?? 300);
  const ticketGoal = Number(formData.get("ticket_goal") ?? 50);
  const numberOfActs = Number(formData.get("number_of_acts") ?? 3);
  const doorsTime = String(formData.get("doors_time") ?? "19:00");
  const startTime = String(formData.get("start_time") ?? "20:00");
  const endTime = String(formData.get("end_time") ?? "00:00");

  if (!venueName || !showDate) {
    redirect(
      "/admin/shows/new?error=Venue%20and%20show%20date%20are%20required"
    );
  }

  if (!Number.isInteger(capacity) || capacity < 1) {
    redirect(
      "/admin/shows/new?error=Capacity%20must%20be%20at%20least%201"
    );
  }

  /*
   * Find an existing venue with the same name.
   */
  const { data: existingVenue, error: venueLookupError } =
    await supabase
      .from("venues")
      .select("id")
      .ilike("name", venueName)
      .limit(1)
      .maybeSingle();

  if (venueLookupError) {
    redirect(
      `/admin/shows/new?error=${encodeURIComponent(
        venueLookupError.message
      )}`
    );
  }

  let venueId = existingVenue?.id;

  /*
   * Create the venue when it does not exist.
   */
  if (!venueId) {
    const { data: newVenue, error: venueInsertError } =
      await supabase
        .from("venues")
        .insert({
          name: venueName,
          default_capacity: capacity,
        })
        .select("id")
        .single();

    if (venueInsertError) {
      redirect(
        `/admin/shows/new?error=${encodeURIComponent(
          venueInsertError.message
        )}`
      );
    }

    venueId = newVenue.id;
  }

  /*
   * Create the show.
   */
  const { data: show, error: showError } = await supabase
    .from("shows")
    .insert({
      show_name: showName || `${venueName} Show`,
      venue_id: venueId,
      show_date: showDate,
      doors_time: doorsTime,
      start_time: startTime,
      end_time: endTime,
      capacity,
      ticket_goal: ticketGoal,
      number_of_acts: numberOfActs,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (showError) {
    redirect(
      `/admin/shows/new?error=${encodeURIComponent(
        showError.message
      )}`
    );
  }

  /*
   * Add the standard ticket categories.
   */
  const { error: ticketError } = await supabase
    .from("ticket_sales")
    .insert([
      {
        show_id: show.id,
        ticket_type: "Offline Presale",
        channel: "offline",
        ticket_price: 12,
      },
      {
        show_id: show.id,
        ticket_type: "Online",
        channel: "online",
        ticket_price: 12,
      },
      {
        show_id: show.id,
        ticket_type: "Door",
        channel: "door",
        ticket_price: 15,
      },
      {
        show_id: show.id,
        ticket_type: "Reserved Table",
        channel: "reserved",
        ticket_price: 18,
      },
    ]);

  if (ticketError) {
    /*
     * Remove the incomplete show if its ticket rows fail.
     */
    await supabase.from("shows").delete().eq("id", show.id);

    redirect(
      `/admin/shows/new?error=${encodeURIComponent(
        ticketError.message
      )}`
    );
  }

  revalidatePath("/admin/shows");
  redirect(`/admin/shows/${show.id}`);
}