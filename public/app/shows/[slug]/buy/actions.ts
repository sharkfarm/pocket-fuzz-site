"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildVenmoPaymentUrl, formatOrderNumber } from "@/lib/venmo";

function asPositiveInt(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export async function createVenmoOrder(formData: FormData) {
  const supabase = await createClient();

  const showId = String(formData.get("show_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();

  if (!showId || !slug || !customerName || !customerEmail) {
    redirect(`/shows/${slug}?error=${encodeURIComponent("Name and email are required.")}`);
  }

  const [{ data: ticketRows, error: ticketError }, { data: merchRows, error: merchError }] = await Promise.all([
    supabase.from("ticket_sales").select("id,ticket_type,ticket_price").eq("show_id", showId),
    supabase.from("merch_products").select("id,name,price,unit_cost").eq("active", true),
  ]);

  if (ticketError || merchError) {
    redirect(`/shows/${slug}?error=${encodeURIComponent(ticketError?.message ?? merchError?.message ?? "Could not load products.")}`);
  }

  const items: Array<{
    item_kind: "ticket" | "merch";
    ticket_sale_id?: string;
    merch_product_id?: string;
    item_name: string;
    item_option?: string | null;
    unit_price: number;
    unit_cost: number;
    quantity: number;
  }> = [];

  for (const ticket of ticketRows ?? []) {
    const quantity = asPositiveInt(formData.get(`ticket_${ticket.id}`));
    if (quantity > 0) {
      items.push({
        item_kind: "ticket",
        ticket_sale_id: ticket.id,
        item_name: ticket.ticket_type,
        item_option: null,
        unit_price: Number(ticket.ticket_price),
        unit_cost: 0,
        quantity,
      });
    }
  }

  for (const merch of merchRows ?? []) {
    const quantity = asPositiveInt(formData.get(`merch_${merch.id}`));
    if (quantity > 0) {
      const isShirt = merch.name.toLowerCase().includes("shirt");
      const selectedSize = String(formData.get(`merch_size_${merch.id}`) ?? "").trim();

      if (isShirt && !selectedSize) {
        redirect(`/shows/${slug}?error=${encodeURIComponent("Select a T-shirt size.")}`);
      }

      items.push({
        item_kind: "merch",
        merch_product_id: merch.id,
        item_name: merch.name,
        item_option: isShirt ? selectedSize : null,
        unit_price: Number(merch.price),
        unit_cost: Number(merch.unit_cost),
        quantity,
      });
    }
  }

  if (items.length === 0) {
    redirect(`/shows/${slug}?error=${encodeURIComponent("Choose at least one ticket or merchandise item.")}`);
  }

  const expectedAmount = items.reduce((total, item) => total + item.unit_price * item.quantity, 0);
  const temporaryNumber = `TEMP-${crypto.randomUUID()}`;

  const { data: order, error: orderError } = await supabase
    .from("venmo_orders")
    .insert({
      order_number: temporaryNumber,
      show_id: showId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      expected_amount: expectedAmount,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect(`/shows/${slug}?error=${encodeURIComponent(orderError?.message ?? "Could not create order.")}`);
  }

  const orderNumber = formatOrderNumber(order.id);
  const { error: numberError } = await supabase.from("venmo_orders").update({ order_number: orderNumber }).eq("id", order.id);
  if (numberError) {
    redirect(`/shows/${slug}?error=${encodeURIComponent(numberError.message)}`);
  }

  const { error: itemError } = await supabase.from("venmo_order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      ...item,
      ticket_sale_id: item.ticket_sale_id ?? null,
      merch_product_id: item.merch_product_id ?? null,
    }))
  );

  if (itemError) {
    await supabase.from("venmo_orders").delete().eq("id", order.id);
    redirect(`/shows/${slug}?error=${encodeURIComponent(itemError.message)}`);
  }

  const note = `${orderNumber} - ${items.map((item) => `${item.quantity} ${item.item_name}${item.item_option ? ` ${item.item_option}` : ""}`).join(", ")}`;
  const venmoUrl = buildVenmoPaymentUrl({ amount: expectedAmount, note });

  redirect(`/shows/${slug}/pay/${order.id}?venmo=${encodeURIComponent(venmoUrl)}`);
}
