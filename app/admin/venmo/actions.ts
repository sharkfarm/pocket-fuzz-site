"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { formatOrderNumber } from "@/lib/venmo";

const VENMO_FEE_RATE = 0.019;
const VENMO_FIXED_FEE = 0.10;

function calculateVenmoServiceFee(subtotal: number) {
  if (subtotal <= 0) return 0;

  const totalWithFee =
    (subtotal + VENMO_FIXED_FEE) / (1 - VENMO_FEE_RATE);

  return Math.max(
    0,
    Math.round((totalWithFee - subtotal) * 100) / 100
  );
}



export async function createManualVenmoOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim().toLowerCase();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();
  const venmoUsername = String(formData.get("venmo_username") ?? "")
    .trim()
    .replace(/^@+/, "");
  const mailingListOptIn = formData.get("mailing_list_opt_in") === "on";
  const addVenmoFee = formData.get("add_venmo_fee") === "on";

  if (!customerName || !customerEmail) {
    redirect("/admin/venmo?error=Name%20and%20email%20are%20required");
  }

  const itemRequests: Array<{
    kind: "ticket" | "merch";
    id: string;
    quantity: number;
    option: string | null;
  }> = [];

  for (let index = 0; index < 5; index += 1) {
    const raw = String(formData.get(`manual_item_${index}`) ?? "").trim();
    const quantity = Number(formData.get(`manual_qty_${index}`) ?? 0);
    const option = String(formData.get(`manual_option_${index}`) ?? "").trim() || null;

    if (!raw || !Number.isInteger(quantity) || quantity <= 0) continue;

    const [kind, id] = raw.split(":");
    if ((kind === "ticket" || kind === "merch") && id) {
      itemRequests.push({
        kind,
        id,
        quantity: Math.min(quantity, 20),
        option,
      });
    }
  }

  if (itemRequests.length === 0) {
    redirect("/admin/venmo?error=Add%20at%20least%20one%20item");
  }

  const ticketIds = itemRequests
    .filter((item) => item.kind === "ticket")
    .map((item) => item.id);

  const merchIds = itemRequests
    .filter((item) => item.kind === "merch")
    .map((item) => item.id);

  const ticketMap = new Map<string, any>();
  const merchMap = new Map<string, any>();

  if (ticketIds.length > 0) {
    const { data, error } = await supabase
      .from("ticket_sales")
      .select("id,show_id,ticket_type,ticket_price")
      .in("id", ticketIds);

    if (error) redirect(`/admin/venmo?error=${encodeURIComponent(error.message)}`);
    for (const row of data ?? []) ticketMap.set(row.id, row);
  }

  if (merchIds.length > 0) {
    const { data, error } = await supabase
      .from("merch_products")
      .select("id,name,price,unit_cost")
      .in("id", merchIds);

    if (error) redirect(`/admin/venmo?error=${encodeURIComponent(error.message)}`);
    for (const row of data ?? []) merchMap.set(row.id, row);
  }

  const items: Array<{
    item_kind: "ticket" | "merch";
    ticket_sale_id: string | null;
    merch_product_id: string | null;
    item_name: string;
    item_option: string | null;
    unit_price: number;
    unit_cost: number;
    quantity: number;
  }> = [];

  let showId: string | null = null;

  for (const request of itemRequests) {
    if (request.kind === "ticket") {
      const ticket = ticketMap.get(request.id);
      if (!ticket) continue;

      if (showId && showId !== ticket.show_id) {
        redirect("/admin/venmo?error=Manual%20ticket%20items%20must%20be%20for%20the%20same%20show");
      }

      showId = ticket.show_id;

      items.push({
        item_kind: "ticket",
        ticket_sale_id: ticket.id,
        merch_product_id: null,
        item_name: ticket.ticket_type,
        item_option: null,
        unit_price: Number(ticket.ticket_price),
        unit_cost: 0,
        quantity: request.quantity,
      });
    } else {
      const merch = merchMap.get(request.id);
      if (!merch) continue;

      items.push({
        item_kind: "merch",
        ticket_sale_id: null,
        merch_product_id: merch.id,
        item_name: merch.name,
        item_option: request.option,
        unit_price: Number(merch.price),
        unit_cost: Number(merch.unit_cost ?? 0),
        quantity: request.quantity,
      });
    }
  }

  if (items.length === 0) {
    redirect("/admin/venmo?error=Could%20not%20resolve%20the%20selected%20items");
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  const serviceFee = addVenmoFee
    ? calculateVenmoServiceFee(subtotal)
    : 0;

  const expectedAmount = subtotal + serviceFee;

  const temporaryNumber = `TEMP-${crypto.randomUUID()}`;

  const { data: order, error: orderError } = await supabase
    .from("venmo_orders")
    .insert({
      order_number: temporaryNumber,
      show_id: showId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      venmo_username: venmoUsername || null,
      expected_amount: expectedAmount,
      service_fee: serviceFee,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect(`/admin/venmo?error=${encodeURIComponent(orderError?.message ?? "Could not create manual order.")}`);
  }

  const orderNumber = formatOrderNumber(order.id);

  const { error: numberError } = await supabase
    .from("venmo_orders")
    .update({ order_number: orderNumber })
    .eq("id", order.id);

  if (numberError) {
    await supabase.from("venmo_orders").delete().eq("id", order.id);
    redirect(`/admin/venmo?error=${encodeURIComponent(numberError.message)}`);
  }

  const { error: itemError } = await supabase
    .from("venmo_order_items")
    .insert(
      items.map((item) => ({
        order_id: order.id,
        ...item,
      }))
    );

  if (itemError) {
    await supabase.from("venmo_orders").delete().eq("id", order.id);
    redirect(`/admin/venmo?error=${encodeURIComponent(itemError.message)}`);
  }

  await syncPurchaserContact({
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    subscribe: mailingListOptIn,
  });

  revalidatePath("/admin/venmo");
  redirect("/admin/venmo?status=pending&saved=manual");
}

async function syncPurchaserContact({
  name,
  email,
  phone,
  subscribe,
}: {
  name: string;
  email: string;
  phone?: string;
  subscribe: boolean;
}) {
  const endpoint = process.env.PFCOM_PURCHASE_CONTACT_URL;
  const secret = process.env.PFCOM_PURCHASE_CONTACT_SECRET;

  if (!endpoint || !secret) {
    console.error("[PF-Com] Purchase contact sync is not configured.");
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pocket-fuzz-secret": secret,
      },
      body: JSON.stringify({
        name,
        email,
        phone: phone || null,
        subscribe,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "[PF-Com] Purchase contact sync failed:",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error("[PF-Com] Purchase contact sync error:", error);
  }
}

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
