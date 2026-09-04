"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export async function approveVenmoOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) redirect("/admin/venmo?error=Order%20ID%20is%20missing");

  const { data: order, error: lookupError } = await supabase
    .from("venmo_orders")
    .select(`
      id, order_number, customer_name, customer_email,
      expected_amount, service_fee, status,
      shows(show_name,show_date,start_time,venues(name,city,state)),
      venmo_order_items(item_kind,item_name,item_option,quantity,unit_price,line_total)
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (lookupError) redirect(`/admin/venmo?error=${encodeURIComponent(lookupError.message)}`);
  if (!order) redirect("/admin/venmo?error=Order%20not%20found");

  const wasApproved = order.status === "approved";

  const { error } = await supabase.rpc("approve_venmo_order", { p_order_id: orderId });
  if (error) redirect(`/admin/venmo?error=${encodeURIComponent(error.message)}`);

  if (!wasApproved && order.customer_email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const items = order.venmo_order_items ?? [];
    const rows = items.map((i) => {
      const total = Number(i.line_total ?? Number(i.unit_price) * Number(i.quantity));
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #ddd"><b>${i.quantity} × ${esc(i.item_name)}</b>${i.item_option ? ` · ${esc(i.item_option)}` : ""}</td><td style="padding:10px 0;border-bottom:1px solid #ddd;text-align:right">${money(total)}</td></tr>`;
    }).join("");

    const show = Array.isArray(order.shows) ? order.shows[0] : order.shows;
    const venue = Array.isArray(show?.venues) ? show.venues[0] : show?.venues;
    const showBlock = show ? `<div style="margin:20px 0;padding:16px;background:#f5f5f4;border-radius:10px"><b>${esc(show.show_name ?? "Pocket Fuzz")}</b><br>${show.show_date ? date(show.show_date) : ""}${show.start_time ? ` · ${time(show.start_time)}` : ""}${venue?.name ? `<br>${esc(venue.name)}${venue.city ? ` · ${esc(venue.city)}` : ""}${venue.state ? `, ${esc(venue.state)}` : ""}` : ""}</div>` : "";

    const fee = Number(order.service_fee ?? 0);
    const subtotal = Number(order.expected_amount) - fee;

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#1c1917"><div style="max-width:620px;margin:auto;padding:28px 16px"><div style="background:white;padding:28px;border-radius:16px"><div style="color:#dc2626;font-size:12px;font-weight:900;letter-spacing:.2em">POCKET FUZZ</div><h1>Payment confirmed</h1><p>Thanks${order.customer_name ? `, ${esc(order.customer_name)}` : ""}. Your Venmo payment has been approved. Keep this email as your receipt.</p>${showBlock}<p style="color:#78716c;margin-bottom:4px">Order</p><b style="font-size:20px">${esc(order.order_number)}</b><table style="width:100%;border-collapse:collapse;margin-top:12px">${rows}${fee > 0 ? `<tr><td style="padding-top:12px;color:#78716c">Subtotal</td><td style="padding-top:12px;text-align:right;color:#78716c">${money(subtotal)}</td></tr><tr><td style="color:#78716c">Venmo service fee</td><td style="text-align:right;color:#78716c">${money(fee)}</td></tr>` : ""}<tr><td style="padding-top:16px;font-size:19px"><b>Total paid</b></td><td style="padding-top:16px;text-align:right;font-size:19px"><b>${money(Number(order.expected_amount))}</b></td></tr></table><p style="margin-top:28px;border-top:1px solid #ddd;padding-top:18px;color:#78716c;font-size:13px">Questions? Reply to this email or contact info@pocket-fuzz.com.</p></div></div></body></html>`;

    const { error: emailError } = await resend.emails.send(
      {
        from: "Pocket Fuzz <info@pocket-fuzz.com>",
        to: [order.customer_email],
        replyTo: "info@pocket-fuzz.com",
        subject: `Pocket Fuzz receipt - ${order.order_number}`,
        html,
      },
      { idempotencyKey: `venmo-receipt/${order.id}` }
    );
    if (emailError) console.error("[Receipt] Send failed:", emailError);
  } else if (!process.env.RESEND_API_KEY) {
    console.error("[Receipt] RESEND_API_KEY is not configured.");
  }

  revalidatePath("/admin/venmo");
  revalidatePath("/admin/shows");
  redirect("/admin/venmo?saved=approved");
}

function money(n: number) {
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
}
function date(v: string) {
  return new Intl.DateTimeFormat("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${v}T00:00:00Z`));
}
function time(v: string) {
  const [h,m]=v.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(new Date(2000,0,1,h,m));
}
function esc(v: string) {
  return v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
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
