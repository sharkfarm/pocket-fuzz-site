"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getSupabase() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return supabase;
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function nonnegativeInt(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Inventory quantities must be whole numbers of zero or more.");
  }

  return parsed;
}

export async function addInventoryItem(formData: FormData) {
  const supabase = await getSupabase();

  const productName = cleanText(formData.get("product_name"));
  const size = cleanText(formData.get("size"));
  const quantity = nonnegativeInt(formData.get("quantity"));
  const reorderLevel = nonnegativeInt(formData.get("reorder_level"));

  if (!productName) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(
        "Product name is required."
      )}`
    );
  }

  const { data: existing, error: lookupError } = await supabase
    .from("inventory")
    .select("id,quantity")
    .ilike("product_name", productName)
    .eq("size", size || null)
    .maybeSingle();

  if (lookupError) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(lookupError.message)}`
    );
  }

  if (existing) {
    const { error } = await supabase
      .from("inventory")
      .update({
        quantity: Number(existing.quantity) + quantity,
        reorder_level: reorderLevel,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      redirect(
        `/admin/inventory?error=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    const { error } = await supabase.from("inventory").insert({
      product_name: productName,
      size: size || null,
      quantity,
      reorder_level: reorderLevel,
      active: true,
    });

    if (error) {
      redirect(
        `/admin/inventory?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?saved=added");
}

export async function adjustInventory(formData: FormData) {
  const supabase = await getSupabase();

  const inventoryId = cleanText(formData.get("inventory_id"));
  const delta = Number(formData.get("delta") ?? 0);

  if (!inventoryId || !Number.isInteger(delta) || delta === 0) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(
        "Invalid inventory adjustment."
      )}`
    );
  }

  const { data: item, error: itemError } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("id", inventoryId)
    .single();

  if (itemError) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(itemError.message)}`
    );
  }

  const nextQuantity = Math.max(0, Number(item.quantity) + delta);

  const { error } = await supabase
    .from("inventory")
    .update({
      quantity: nextQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inventoryId);

  if (error) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?saved=adjusted");
}

export async function updateInventoryItem(formData: FormData) {
  const supabase = await getSupabase();

  const inventoryId = cleanText(formData.get("inventory_id"));
  const productName = cleanText(formData.get("product_name"));
  const size = cleanText(formData.get("size"));
  const quantity = nonnegativeInt(formData.get("quantity"));
  const reorderLevel = nonnegativeInt(formData.get("reorder_level"));
  const active = formData.get("active") === "on";

  if (!inventoryId || !productName) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(
        "Inventory item and product name are required."
      )}`
    );
  }

  const { error } = await supabase
    .from("inventory")
    .update({
      product_name: productName,
      size: size || null,
      quantity,
      reorder_level: reorderLevel,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inventoryId);

  if (error) {
    redirect(
      `/admin/inventory?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?saved=updated");
}
