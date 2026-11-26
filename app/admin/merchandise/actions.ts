"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
const path = "/admin/merchandise";
function fail(message: string): never { redirect(path + "?error=" + encodeURIComponent(message) + "#catalog"); }
function refresh() { for (const url of [path, "/merch", "/admin/inventory", "/admin/venmo"]) revalidatePath(url); }
export async function saveMerchProduct(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const id = String(form.get("product_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const image = String(form.get("image_url") ?? "").trim();
  const price = String(form.get("price") ?? "");
  const cost = String(form.get("unit_cost") ?? "");
  if (!name || name.length > 200 || description.length > 4000) fail("Enter a name up to 200 characters and description up to 4,000 characters.");
  if (![price, cost].every(value => /^\d{1,8}(\.\d{1,2})?$/.test(value))) fail("Price and cost must be nonnegative amounts with at most two decimal places.");
  if (image) {
    const local = image.startsWith("/") && !image.startsWith("//") && !image.includes("\\");
    let remote = false;
    try { remote = new URL(image).protocol === "https:"; } catch {}
    if ((!local && !remote) || image.length > 2000) fail("Use an HTTPS image URL or a path such as /images/shirt.jpg.");
  }
  const product = { name, description: description || null, image_url: image || null, price: Number(price), unit_cost: Number(cost), active: form.get("active") === "on" };
  const request = id ? db.from("merch_products").update(product).eq("id", id) : db.from("merch_products").insert(product);
  const { error } = await request.select("id").single();
  if (error) fail(error.message);
  refresh(); redirect(path + "?saved=product#catalog");
}
export async function archiveMerchProduct(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const id = String(form.get("product_id") ?? "");
  if (!id) fail("Product ID is required.");
  const { error } = await db.from("merch_products").update({ active: false }).eq("id", id).select("id").single();
  if (error) fail(error.message);
  refresh(); redirect(path + "?saved=archived#catalog");
}
