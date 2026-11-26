import { createClient } from "@/lib/supabase/server";
import { saveMerchProduct, archiveMerchProduct } from "@/app/admin/merchandise/actions";
type Product = { id: string; name: string; description: string | null; price: number | string; unit_cost: number | string; image_url: string | null; active: boolean };
const input = "mt-2 block w-full min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-3";
export default async function MerchCatalog() {
  const db = await createClient();
  const { data, error } = await db.from("merch_products").select("id,name,description,price,unit_cost,image_url,active").order("name");
  return <section id="catalog" className="mt-8 scroll-mt-32 rounded-2xl border border-stone-800 bg-stone-900 p-4 sm:p-6">
    <h2 className="text-xl font-black uppercase">Product Catalog</h2>
    <p className="mt-2 text-sm leading-6 text-stone-400">Manage items in the public shop. Prices and costs apply to new orders; existing sales keep their original values. Archive an item to remove it from the shop while retaining its history.</p>
    {error ? <p role="alert" className="mt-4 text-red-300">{error.message}</p> : <div className="mt-5 space-y-4">{((data ?? []) as Product[]).map(product => <details key={product.id} className="rounded-xl border border-stone-700 p-4">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
        <span className="font-bold">{product.name} <span className="ml-2 text-xs text-stone-400">{product.active ? "Visible in shop" : "Archived / hidden"}</span></span>
        <span className="text-sm text-stone-400">Price {Number(product.price).toFixed(2)} · Cost {Number(product.unit_cost).toFixed(2)} · Edit</span>
      </summary>
      {product.image_url && <img src={product.image_url} alt={product.name} className="mt-4 h-36 w-36 rounded-lg bg-stone-950 object-contain" />}
      <ProductForm product={product} />
      {product.active && <form action={archiveMerchProduct} className="mt-4 border-t border-stone-800 pt-4"><input type="hidden" name="product_id" value={product.id} /><button className="rounded-lg border border-stone-600 px-4 py-3 text-sm font-bold">Remove From Shop (Archive)</button></form>}
    </details>)}
    {!data?.length && <p className="text-stone-400">No products yet. Add your first item below.</p>}</div>}
    <details className="mt-6 rounded-xl border border-stone-700 p-4" open={!data?.length}><summary className="cursor-pointer font-bold">Add New Product</summary><ProductForm /></details>
  </section>;
}
function ProductForm({ product }: { product?: Product }) {
  return <form action={saveMerchProduct} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
    <input type="hidden" name="product_id" value={product?.id ?? ""} />
    <label className="min-w-0 text-sm font-bold">Item name<input name="name" maxLength={200} required defaultValue={product?.name ?? ""} className={input} /></label>
    <label className="flex items-center gap-3 self-end rounded-lg border border-stone-700 px-3 py-3 text-sm"><input name="active" type="checkbox" defaultChecked={product?.active ?? true} className="h-5 w-5" />Visible in public shop</label>
    <label className="min-w-0 text-sm font-bold">Price ($)<input name="price" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={Number(product?.price ?? 0).toFixed(2)} className={input} /></label>
    <label className="min-w-0 text-sm font-bold">Unit cost ($)<input name="unit_cost" type="number" min="0" max="99999999.99" step="0.01" required defaultValue={Number(product?.unit_cost ?? 0).toFixed(2)} className={input} /></label>
    <label className="min-w-0 text-sm font-bold sm:col-span-2">Image URL / path<input name="image_url" maxLength={2000} placeholder="https://… or /images/shirt.jpg" defaultValue={product?.image_url ?? ""} className={input} /><span className="mt-1 block text-xs font-normal text-stone-400">Paste a hosted HTTPS image URL, or reference a file in public/images using /images/filename.jpg. Clear to remove the image.</span></label>
    <label className="min-w-0 text-sm font-bold sm:col-span-2">Description<textarea name="description" maxLength={4000} rows={3} defaultValue={product?.description ?? ""} className={input} /></label>
    <div className="sm:col-span-2"><button className="rounded-lg bg-red-600 px-5 py-3 font-bold">{product ? "Save Product" : "Add Product"}</button></div>
  </form>;
}
