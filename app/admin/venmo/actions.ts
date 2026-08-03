"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function approveVenmoOrder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const orderId = String(formData.get("order_id") ?? "");
  const { error } = await supabase.rpc("approve_venmo_order", {
    p_order_id: orderId,
  });

  if (error) {
    redirect(`/admin/venmo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/venmo");
  revalidatePath("/admin/shows");
  redirect("/admin/venmo?saved=approved");
}

export async function declineVenmoOrder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const orderId = String(formData.get("order_id") ?? "");

  const { error } = await supabase
    .from("venmo_orders")
    .update({
      status: "declined",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", orderId);

  if (error) {
    redirect(`/admin/venmo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/venmo");
  redirect("/admin/venmo?saved=declined");
}

export async function deleteVenmoOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const orderId = String(formData.get("order_id") ?? "");

  if (!orderId) {
    throw new Error("Order ID is missing.");
  }

  const { data: order, error: lookupError } = await supabase
    .from("venmo_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (lookupError) {
    redirect(
      `/admin/venmo?error=${encodeURIComponent(
        lookupError.message
      )}`
    );
  }

  if (!order) {
    redirect("/admin/venmo?error=Order%20not%20found");
  }

  if (order.status === "approved") {
    redirect(
      "/admin/venmo?error=Approved%20orders%20cannot%20be%20deleted"
    );
  }

  const { error } = await supabase
    .from("venmo_orders")
    .delete()
    .eq("id", orderId);

  if (error) {
    redirect(
      `/admin/venmo?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/admin/venmo");
  redirect("/admin/venmo?saved=deleted");
}
