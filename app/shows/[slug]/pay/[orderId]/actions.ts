"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitVenmoConfirmation(formData: FormData) {
  const supabase = await createClient();

  const orderId = String(formData.get("order_id") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const venmoUsername = String(
    formData.get("venmo_username") ?? ""
  )
    .trim()
    .replace(/^@+/, "");

  if (!orderId || !slug) {
    throw new Error("Order ID or show slug is missing.");
  }

  if (!venmoUsername) {
    redirect(
      `/shows/${slug}/pay/${orderId}?error=${encodeURIComponent(
        "Enter the Venmo username used for payment."
      )}`
    );
  }

  // Do not roll an already-finalized order backward to "submitted".
  const { data: existingOrder, error: lookupError } = await supabase
    .from("venmo_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (lookupError) {
    redirect(
      `/shows/${slug}/pay/${orderId}?error=${encodeURIComponent(
        lookupError.message
      )}`
    );
  }

  if (!existingOrder) {
    redirect(
      `/shows/${slug}?error=${encodeURIComponent(
        "Venmo order could not be found."
      )}`
    );
  }

  if (
    existingOrder.status === "approved" ||
    existingOrder.status === "declined"
  ) {
    redirect(`/shows/${slug}/pay/${orderId}`);
  }

  const { error } = await supabase
    .from("venmo_orders")
    .update({
      venmo_username: venmoUsername,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    redirect(
      `/shows/${slug}/pay/${orderId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/venmo");
  revalidatePath(`/shows/${slug}`);
  revalidatePath(`/shows/${slug}/pay/${orderId}`);

  redirect(`/shows/${slug}/pay/${orderId}`);
}
