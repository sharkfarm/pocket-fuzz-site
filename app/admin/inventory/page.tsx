import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addInventoryItem,
  adjustInventory,
  updateInventoryItem,
} from "./actions";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

type InventoryItem = {
  id: string;
  product_name: string;
  size: string | null;
  quantity: number;
  reorder_level: number;
  active: boolean;
};

export default async function InventoryPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data, error } = await supabase
    .from("inventory")
    .select("id,product_name,size,quantity,reorder_level,active")
    .order("product_name", { ascending: true })
    .order("size", { ascending: true });

  const items = (data ?? []) as InventoryItem[];

  const activeItems = items.filter((item) => item.active);
  const products = new Set(
    activeItems.map((item) => item.product_name.toLowerCase())
  ).size;

  const totalItems = activeItems.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const lowStock = activeItems.filter(
    (item) =>
      item.quantity > 0 &&
      item.quantity <= item.reorder_level
  ).length;

  const outOfStock = activeItems.filter(
    (item) => item.quantity === 0
  ).length;

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz Admin
            </p>

            <h1 className="mt-3 text-4xl font-black uppercase">
              Inventory
            </h1>

            <p className="mt-2 text-stone-400">
              Keep merchandise quantities simple and current.
            </p>
          </div>

          <Link
            href="/admin/merchandise"
            className="w-fit rounded-lg border border-stone-700 px-4 py-3 text-sm font-bold hover:border-stone-500"
          >
            Merchandise
          </Link>
        </div>

        {query.saved ? (
          <div className="mt-7 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-200">
            Inventory {query.saved}.
          </div>
        ) : null}

        {query.error || error ? (
          <div className="mt-7 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            {query.error ?? error?.message}
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Products" value={String(products)} />
          <Metric label="Items On Hand" value={String(totalItems)} />
          <Metric label="Low Stock" value={String(lowStock)} />
          <Metric label="Out of Stock" value={String(outOfStock)} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Current Inventory
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-stone-950 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">On Hand</th>
                  <th className="px-6 py-4">Reorder</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Quick Adjust</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const out = item.quantity === 0;
                  const low =
                    !out &&
                    item.quantity <= item.reorder_level;

                  return (
                    <tr
                      key={item.id}
                      className={
                        out
                          ? "border-t border-red-950 bg-red-950/20"
                          : low
                            ? "border-t border-amber-950 bg-amber-950/20"
                            : "border-t border-stone-800"
                      }
                    >
                      <td className="px-6 py-5 font-bold">
                        {item.product_name}
                      </td>

                      <td className="px-6 py-5 text-stone-400">
                        {item.size || "—"}
                      </td>

                      <td className="px-6 py-5 text-2xl font-black">
                        {item.quantity}
                      </td>

                      <td className="px-6 py-5">
                        {item.reorder_level}
                      </td>

                      <td className="px-6 py-5">
                        {!item.active ? (
                          <Badge label="Inactive" />
                        ) : out ? (
                          <Badge label="Out" danger />
                        ) : low ? (
                          <Badge label="Low" warning />
                        ) : (
                          <Badge label="OK" />
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex gap-2">
                          <AdjustButton
                            inventoryId={item.id}
                            delta={-1}
                            label="−"
                          />
                          <AdjustButton
                            inventoryId={item.id}
                            delta={1}
                            label="+"
                          />

                          <details>
                            <summary className="cursor-pointer rounded-lg border border-stone-700 px-3 py-2 text-sm font-bold">
                              Edit
                            </summary>

                            <form
                              action={updateInventoryItem}
                              className="absolute right-6 z-20 mt-2 grid w-[340px] gap-3 rounded-xl border border-stone-700 bg-stone-900 p-4 shadow-2xl"
                            >
                              <input
                                type="hidden"
                                name="inventory_id"
                                value={item.id}
                              />

                              <Field
                                label="Product"
                                name="product_name"
                                defaultValue={item.product_name}
                                required
                              />

                              <Field
                                label="Size"
                                name="size"
                                defaultValue={item.size ?? ""}
                              />

                              <Field
                                label="Quantity"
                                name="quantity"
                                type="number"
                                min="0"
                                step="1"
                                defaultValue={String(item.quantity)}
                                required
                              />

                              <Field
                                label="Reorder Level"
                                name="reorder_level"
                                type="number"
                                min="0"
                                step="1"
                                defaultValue={String(item.reorder_level)}
                                required
                              />

                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  name="active"
                                  defaultChecked={item.active}
                                />
                                Active
                              </label>

                              <button className="rounded-lg bg-red-600 px-4 py-3 font-black uppercase hover:bg-red-500">
                                Save
                              </button>
                            </form>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-stone-500"
                    >
                      No inventory has been entered yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">
            Add Stock
          </h2>

          <p className="mt-2 text-sm text-stone-400">
            If the product and size already exist, this quantity is added to the current stock.
          </p>

          <form
            action={addInventoryItem}
            className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5"
          >
            <Field
              label="Product"
              name="product_name"
              placeholder="T-Shirt"
              required
            />

            <Field
              label="Size"
              name="size"
              placeholder="S, M, L, XL"
            />

            <Field
              label="Quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              required
            />

            <Field
              label="Reorder Level"
              name="reorder_level"
              type="number"
              min="0"
              step="1"
              defaultValue="5"
              required
            />

            <div className="flex items-end">
              <button className="w-full rounded-lg bg-red-600 px-5 py-3 font-black uppercase hover:bg-red-500">
                Add Stock
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function AdjustButton({
  inventoryId,
  delta,
  label,
}: {
  inventoryId: string;
  delta: number;
  label: string;
}) {
  return (
    <form action={adjustInventory}>
      <input
        type="hidden"
        name="inventory_id"
        value={inventoryId}
      />

      <button
        type="submit"
        name="delta"
        value={String(delta)}
        className="h-10 w-10 rounded-lg border border-stone-700 text-xl font-black hover:border-red-700 hover:text-red-300"
      >
        {label}
      </button>
    </form>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
      <p className="text-xs font-black uppercase tracking-wide text-stone-500">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black">
        {value}
      </p>
    </div>
  );
}

function Badge({
  label,
  danger = false,
  warning = false,
}: {
  label: string;
  danger?: boolean;
  warning?: boolean;
}) {
  const className = danger
    ? "border-red-800 text-red-300"
    : warning
      ? "border-amber-800 text-amber-300"
      : "border-stone-700 text-stone-400";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${className}`}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  min,
  step,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  min?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">
        {label}
      </span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        step={step}
        required={required}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
      />
    </label>
  );
}
