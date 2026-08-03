import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveVenmoOrder, declineVenmoOrder } from "./actions";

type PageProps = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function VenmoAdminPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: orders, error } = await supabase
    .from("venmo_orders")
    .select(`
      id,
      order_number,
      customer_name,
      customer_email,
      venmo_username,
      expected_amount,
      status,
      submitted_at,
      shows(show_name,show_date),
      venmo_order_items(item_name,item_option,quantity,line_total)
    `)
    .in("status", ["submitted", "pending"])
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
        <h1 className="mt-3 text-4xl font-black uppercase">Venmo Payments</h1>

        {query.saved ? <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-200">Order {query.saved}.</div> : null}
        {query.error || error ? <div className="mt-6 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">{query.error ?? error?.message}</div> : null}

        <div className="mt-8 space-y-5">
          {(orders ?? []).map((order) => {
            const show = Array.isArray(order.shows) ? order.shows[0] : order.shows;
            return (
              <article key={order.id} className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-stone-500">{order.order_number}</p>
                    <h2 className="mt-1 text-2xl font-black">{order.customer_name}</h2>
                    <p className="text-stone-400">@{order.venmo_username || "not submitted"} · {order.customer_email}</p>
                    <p className="mt-2 text-sm text-stone-500">{show?.show_name || "Show"}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-3xl font-black">{formatCurrency(Number(order.expected_amount))}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-amber-300">{order.status}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 border-t border-stone-800 pt-5">
                  {(order.venmo_order_items ?? []).map((item, index) => (
                    <div key={`${item.item_name}-${index}`} className="flex justify-between text-sm">
                      <span>
                        {item.quantity} × {item.item_name}
                        {item.item_option ? ` — Size ${item.item_option}` : ""}
                      </span>
                      <span>{formatCurrency(Number(item.line_total))}</span>
                    </div>
                  ))}
                </div>

                {order.status === "submitted" ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <form action={approveVenmoOrder}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <button className="rounded-lg bg-emerald-600 px-5 py-3 font-black uppercase hover:bg-emerald-500">Approve</button>
                    </form>
                    <form action={declineVenmoOrder}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <button className="rounded-lg border border-red-700 px-5 py-3 font-black uppercase text-red-300 hover:bg-red-950">Decline</button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}

          {(orders ?? []).length === 0 ? <div className="rounded-2xl border border-stone-800 bg-stone-900 p-10 text-center text-stone-500">No pending Venmo orders.</div> : null}
        </div>
      </div>
    </main>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
