import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    slug: string;
    orderId: string;
  }>;
  searchParams: Promise<{
    venmo?: string;
  }>;
};

export default async function VenmoPayPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, orderId } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("venmo_orders")
    .select(`
      id,
      order_number,
      expected_amount,
      customer_name,
      status,
      venmo_order_items (
        item_name,
        quantity,
        unit_price,
        line_total
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-stone-100">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
          Pocket Fuzz
        </p>

        <h1 className="mt-3 text-4xl font-black uppercase">
          Pay with Venmo
        </h1>

        <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <p className="text-sm text-stone-400">Order</p>
          <p className="text-2xl font-black">{order.order_number}</p>

          <div className="mt-6 space-y-3">
            {(order.venmo_order_items ?? []).map((item, index) => (
              <div
                key={`${item.item_name}-${index}`}
                className="flex justify-between border-b border-stone-800 pb-3"
              >
                <span>
                  {item.quantity} × {item.item_name}
                </span>

                <strong>
                  {formatCurrency(Number(item.line_total))}
                </strong>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-between text-xl font-black">
            <span>Total</span>
            <span>{formatCurrency(Number(order.expected_amount))}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <Image
              src="/images/PF-Venmo_qr.png"
              alt="Pocket Fuzz Venmo QR code"
              width={640}
              height={560}
              className="h-auto w-full"
              priority
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-stone-300">
              Pay <strong>@pocketfuzz</strong>.
            </p>

            <p className="mt-3 text-sm leading-6 text-stone-400">
              Please leave the order number{" "}
              <strong className="text-stone-200">{order.order_number}</strong>{" "}
              in the Venmo note. We will verify the payment directly in Venmo.
            </p>

            {query.venmo ? (
              <a
                href={query.venmo}
                target="_blank"
                rel="noreferrer"
                className="mt-5 rounded-lg bg-blue-600 px-5 py-4 text-center font-black uppercase hover:bg-blue-500"
              >
                Open Venmo
              </a>
            ) : null}

            <Link
              href={`/shows/${slug}`}
              className="mt-3 rounded-lg border border-stone-700 px-5 py-3 text-center text-sm font-bold hover:border-stone-500"
            >
              Back to Show
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/30 p-6">
          <h2 className="font-black uppercase text-amber-300">
            What happens next
          </h2>

          <p className="mt-3 text-sm leading-6 text-stone-300">
            Your order is saved as pending. After we find the matching payment
            in Venmo, we will approve the order and count the tickets as sold.
            You do not need to return here or press another confirmation button.
          </p>
        </div>
      </div>
    </main>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
