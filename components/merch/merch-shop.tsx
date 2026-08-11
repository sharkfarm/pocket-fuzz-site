"use client";

import { useState } from "react";
import { createMerchOrder } from "@/app/merch/actions";

export type MerchProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
};

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

export default function MerchShop({
  products,
}: {
  products: MerchProduct[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function updateQuantity(key: string, rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);
    const quantity = Number.isFinite(parsed)
      ? Math.max(0, Math.min(20, parsed))
      : 0;

    setQuantities((current) => ({
      ...current,
      [key]: quantity,
    }));
  }

  function getQuantity(key: string) {
    return quantities[key] ?? 0;
  }

  function productQuantity(product: MerchProduct) {
    const isShirt = product.name.toLowerCase().includes("shirt");

    if (isShirt) {
      return SHIRT_SIZES.reduce(
        (sum, size) =>
          sum + getQuantity(`merch_${product.id}_${size}`),
        0
      );
    }

    return getQuantity(`merch_${product.id}`);
  }

  function productSubtotal(product: MerchProduct) {
    return productQuantity(product) * Number(product.price);
  }

  const itemCount = products.reduce(
    (sum, product) => sum + productQuantity(product),
    0
  );

  const subtotal = products.reduce(
    (sum, product) => sum + productSubtotal(product),
    0
  );

  const venmoServiceFee = calculateVenmoServiceFee(subtotal);
  const total = subtotal + venmoServiceFee;

  return (
    <form action={createMerchOrder} className="mt-10">
      {products.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {products.map((product) => {
            const isShirt = product.name.toLowerCase().includes("shirt");
            const price = Number(product.price);
            const subtotal = productSubtotal(product);

            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-stone-800 bg-stone-950">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <div>
                        <p className="text-4xl font-black uppercase tracking-tight text-stone-700">
                          Pocket Fuzz
                        </p>
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.25em] text-stone-600">
                          Product photo coming soon
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 className="text-2xl font-black uppercase">
                        {product.name}
                      </h2>

                      {product.description ? (
                        <p className="mt-3 leading-7 text-stone-400">
                          {product.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="whitespace-nowrap text-2xl font-black text-red-500">
                        {formatCurrency(price)}
                      </p>

                      {subtotal > 0 ? (
                        <p className="mt-2 text-sm font-bold text-stone-300">
                          {productQuantity(product)} item
                          {productQuantity(product) === 1 ? "" : "s"} ·{" "}
                          {formatCurrency(subtotal)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {isShirt ? (
                    <div className="mt-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">
                        Quantity by size
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {SHIRT_SIZES.map((size) => {
                          const key = `merch_${product.id}_${size}`;

                          return (
                            <label
                              key={size}
                              className="rounded-lg border border-stone-800 bg-stone-950 p-3"
                            >
                              <span className="block text-center text-sm font-black">
                                {size}
                              </span>

                              <input
                                name={key}
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="20"
                                step="1"
                                value={getQuantity(key)}
                                onChange={(event) =>
                                  updateQuantity(
                                    key,
                                    event.currentTarget.value
                                  )
                                }
                                className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-900 px-2 py-2 text-center font-bold"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <label className="mt-6 block max-w-32">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-stone-500">
                        Quantity
                      </span>

                      <input
                        name={`merch_${product.id}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        step="1"
                        value={getQuantity(`merch_${product.id}`)}
                        onChange={(event) =>
                          updateQuantity(
                            `merch_${product.id}`,
                            event.currentTarget.value
                          )
                        }
                        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 text-center font-bold"
                      />
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-8 text-stone-400">
          Merch is coming soon.
        </div>
      )}

      {products.length > 0 ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-xl font-black uppercase">
              Your Information
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="customer_name" required />
              <Field
                label="Email"
                name="customer_email"
                type="email"
                required
              />
              <Field
                label="Phone"
                name="customer_phone"
                type="tel"
              />
            </div>
          </section>

          <aside className="rounded-2xl border border-stone-800 bg-stone-900 p-6 lg:sticky lg:top-6 lg:self-start">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">
              Order Summary
            </p>

            <div className="mt-5 space-y-3">
              {products
                .filter((product) => productQuantity(product) > 0)
                .map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span className="text-stone-400">
                      {product.name} × {productQuantity(product)}
                    </span>

                    <strong>
                      {formatCurrency(productSubtotal(product))}
                    </strong>
                  </div>
                ))}
            </div>

            <div className="mt-5 flex justify-between border-t border-stone-800 pt-5">
              <span className="text-stone-400">Items</span>
              <strong>{itemCount}</strong>
            </div>

            <div className="mt-5 space-y-3 border-t border-stone-800 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-stone-400">
                  Venmo service fee
                </span>
                <strong>{formatCurrency(venmoServiceFee)}</strong>
              </div>

              <div className="flex items-end justify-between border-t border-stone-800 pt-4">
                <span className="font-black uppercase">Total</span>
                <strong className="text-3xl text-red-500">
                  {formatCurrency(total)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={itemCount === 0}
              className="mt-6 w-full rounded-lg bg-red-600 px-6 py-4 font-black uppercase tracking-wide text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
            >
              Checkout with Venmo
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-stone-500">
              One order. One Venmo payment.
            </p>
          </aside>
        </div>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
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
        required={required}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3"
      />
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}
