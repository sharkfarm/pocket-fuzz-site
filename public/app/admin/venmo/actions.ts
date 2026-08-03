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
