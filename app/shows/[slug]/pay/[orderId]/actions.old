"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitVenmoConfirmation(formData: FormData) {
  const supabase = await createClient();

  const orderId = String(formData.get("order_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const venmoUsername = String(formData.get("venmo_username") ?? "")
    .trim()
    .replace(/^@/, "");

  if (!orderId || !slug || !venmoUsername) {
    redirect(
      `/shows/${slug}/pay/${orderId}?error=${encodeURIComponent(
        "Enter the Venmo username used for payment."
      )}`
    );
  }

  const { error } = await supabase
    .from("venmo_orders")
    .update({
      venmo_username: venmoUsername,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending");

  if (error) {
    redirect(
      `/shows/${slug}/pay/${orderId}?error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(`/shows/${slug}/pay/${orderId}/thanks`);
}
