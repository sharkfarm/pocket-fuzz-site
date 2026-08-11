"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildVenmoPaymentUrl,
  formatOrderNumber,
} from "@/lib/venmo";

const SHIRT_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

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

function positiveInt(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(parsed, 20);
}

export async function createMerchOrder(formData: FormData) {
  const supabase = await createClient();

  const customerName = String(
    formData.get("customer_name") ?? ""
  ).trim();

  const customerEmail = String(
    formData.get("customer_email") ?? ""
  ).trim();

  const customerPhone = String(
    formData.get("customer_phone") ?? ""
  ).trim();

  if (!customerName || !customerEmail) {
    redirect(
      `/merch?error=${encodeURIComponent(
        "Name and email are required."
      )}`
    );
  }

  const { data: products, error: productError } = await supabase
    .from("merch_products")
    .select("id,name,price,unit_cost")
    .eq("active", true);

  if (productError) {
    redirect(
      `/merch?error=${encodeURIComponent(productError.message)}`
    );
  }

  const items: Array<{
    item_kind: "merch";
    ticket_sale_id: null;
    merch_product_id: string;
    item_name: string;
    item_option: string | null;
    unit_price: number;
    unit_cost: number;
    quantity: number;
  }> = [];

  for (const product of products ?? []) {
    const isShirt = product.name.toLowerCase().includes("shirt");
    const unitPrice = Number(product.price);
    const unitCost = Number(product.unit_cost ?? 0);

    if (isShirt) {
      for (const size of SHIRT_SIZES) {
        const quantity = positiveInt(
          formData.get(`merch_${product.id}_${size}`)
        );

        if (quantity > 0) {
          items.push({
            item_kind: "merch",
            ticket_sale_id: null,
            merch_product_id: product.id,
            item_name: product.name,
            item_option: size,
            unit_price: unitPrice,
            unit_cost: unitCost,
            quantity,
          });
        }
      }
    } else {
      const quantity = positiveInt(
        formData.get(`merch_${product.id}`)
      );

      if (quantity > 0) {
        items.push({
          item_kind: "merch",
          ticket_sale_id: null,
          merch_product_id: product.id,
          item_name: product.name,
          item_option: null,
          unit_price: unitPrice,
          unit_cost: unitCost,
          quantity,
        });
      }
    }
  }

  if (items.length === 0) {
    redirect(
      `/merch?error=${encodeURIComponent(
        "Choose at least one merchandise item."
      )}`
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  const venmoServiceFee = calculateVenmoServiceFee(subtotal);
  const expectedAmount = subtotal + venmoServiceFee;

  const temporaryNumber = `TEMP-${crypto.randomUUID()}`;

  const { data: order, error: orderError } = await supabase
    .from("venmo_orders")
    .insert({
      order_number: temporaryNumber,
      show_id: null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      expected_amount: expectedAmount,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    redirect(
      `/merch?error=${encodeURIComponent(
        orderError?.message ?? "Could not create merchandise order."
      )}`
    );
  }

  const orderNumber = formatOrderNumber(order.id);

  const { error: numberError } = await supabase
    .from("venmo_orders")
    .update({
      order_number: orderNumber,
    })
    .eq("id", order.id);

  if (numberError) {
    redirect(
      `/merch?error=${encodeURIComponent(numberError.message)}`
    );
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
    await supabase
      .from("venmo_orders")
      .delete()
      .eq("id", order.id);

    redirect(
      `/merch?error=${encodeURIComponent(itemError.message)}`
    );
  }

  const note = `${orderNumber} - ${items
    .map(
      (item) =>
        `${item.quantity} ${item.item_name}${
          item.item_option ? ` ${item.item_option}` : ""
        }`
    )
    .join(", ")}`;

  const venmoUrl = buildVenmoPaymentUrl({
    amount: expectedAmount,
    note,
  });

  redirect(
    `/merch/pay/${order.id}?venmo=${encodeURIComponent(venmoUrl)}`
  );
}
