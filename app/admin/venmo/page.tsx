import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveVenmoOrder,
  declineVenmoOrder,
  deleteVenmoOrder,
  createManualVenmoOrder,
} from "./actions";

type OrderFilter =
  | "pending"
  | "approved"
  | "declined"
  | "all";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    status?: string;
  }>;
};

const validFilters: OrderFilter[] = [
  "pending",
  "approved",
  "declined",
  "all",
];

export default async function VenmoAdminPage({
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

  const requestedStatus = String(query.status ?? "pending");

  const activeFilter: OrderFilter = validFilters.includes(
    requestedStatus as OrderFilter
  )
    ? (requestedStatus as OrderFilter)
    : "pending";

  let ordersQuery = supabase
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
      created_at,
      shows (
        show_name,
        show_date
      ),
      venmo_order_items (
        item_name,
        item_option,
        quantity,
        line_total
      )
    `)
    .order("created_at", { ascending: false });

  if (activeFilter !== "all") {
    ordersQuery = ordersQuery.eq("status", activeFilter);
  }

  const { data: orders, error } = await ordersQuery;

  const { data: manualTickets } = await supabase
    .from("ticket_sales")
    .select(`
      id,
      ticket_type,
      ticket_price,
      ticket_mode,
      shows (
        show_name,
        show_date
      )
    `)
    .neq("ticket_mode", "external")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: manualMerch } = await supabase
    .from("merch_products")
    .select("id,name,price")
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-3 text-4xl font-black uppercase">
              Venmo Payments
            </h1>
          </div>

          <Link
            href="/admin/shows"
            className="w-fit rounded-lg border border-stone-700 px-4 py-3 text-sm font-bold hover:border-stone-500"
          >
            Back to Shows
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-stone-800 bg-stone-900 p-4 text-sm text-stone-400">
          Pending means the checkout was created but payment has not yet been
          verified. Match the order against Venmo by order number, amount,
          customer name, and time, then click <strong className="text-stone-200">Approve</strong>.
        </div>

        {query.saved ? (
          <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-200">
            {getSavedMessage(query.saved)}
          </div>
        ) : null}

        {query.error || error ? (
          <div className="mt-6 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            {query.error ?? error?.message}
          </div>
        ) : null}


        <details className="mt-8 rounded-2xl border border-stone-800 bg-stone-900">
          <summary className="cursor-pointer px-6 py-5 font-black uppercase">
            + Add Manual Order
          </summary>

          <form action={createManualVenmoOrder} className="border-t border-stone-800 p-6">
            <p className="text-sm leading-6 text-stone-400">
              Use this when payment was received directly in Venmo. The order is created as
              Pending; click Approve afterward to record the sale and send the receipt.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <AdminField label="Customer Name" name="customer_name" required />
              <AdminField label="Customer Email" name="customer_email" type="email" required />
              <AdminField label="Phone" name="customer_phone" type="tel" />
              <AdminField label="Venmo Username" name="venmo_username" placeholder="@username" />
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-stone-800 bg-stone-950 p-4">
              <input
                type="checkbox"
                name="mailing_list_opt_in"
                defaultChecked
                className="mt-1 h-4 w-4 accent-red-600"
              />
              <span>
                <span className="block font-bold">Join the Pocket Fuzz mailing list</span>
                <span className="mt-1 block text-xs text-stone-500">
                  Customer is always added to PF-Com. Checked adds them to the subscribed mailing list.
                </span>
              </span>
            </label>

            <div className="mt-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">
                Items
              </p>

              <div className="mt-3 space-y-3">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-stone-800 bg-stone-950 p-4 md:grid-cols-[1fr_100px_160px]"
                  >
                    <select
                      name={`manual_item_${index}`}
                      className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-3"
                      defaultValue=""
                    >
                      <option value="">Select item...</option>

                      {(manualTickets ?? []).map((ticket) => {
                        const show = Array.isArray(ticket.shows)
                          ? ticket.shows[0]
                          : ticket.shows;

                        return (
                          <option key={`ticket-${ticket.id}`} value={`ticket:${ticket.id}`}>
                            Ticket · {show?.show_name ?? "Show"}
                            {show?.show_date ? ` ${formatDate(show.show_date)}` : ""}
                            {" · "}
                            {ticket.ticket_type}
                            {" · "}
                            {formatCurrency(Number(ticket.ticket_price))}
                          </option>
                        );
                      })}

                      {(manualMerch ?? []).map((merch) => (
                        <option key={`merch-${merch.id}`} value={`merch:${merch.id}`}>
                          Merch · {merch.name} · {formatCurrency(Number(merch.price))}
                        </option>
                      ))}
                    </select>

                    <input
                      name={`manual_qty_${index}`}
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      defaultValue={index === 0 ? 1 : 0}
                      className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-3"
                      aria-label={`Item ${index + 1} quantity`}
                    />

                    <input
                      name={`manual_option_${index}`}
                      placeholder="Size (if merch)"
                      className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-3"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 rounded-lg bg-red-600 px-6 py-4 font-black uppercase hover:bg-red-500"
            >
              Create Pending Order
            </button>
          </form>
        </details>

        <nav className="mt-8 flex flex-wrap gap-3">
          {validFilters.map((filter) => (
            <Link
              key={filter}
              href={`/admin/venmo?status=${filter}`}
              className={
                activeFilter === filter
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-black uppercase text-white"
                  : "rounded-lg border border-stone-700 px-4 py-2 text-sm font-black uppercase text-stone-300 hover:border-stone-500"
              }
            >
              {formatFilterLabel(filter)}
            </Link>
          ))}
        </nav>

        <div className="mt-8 space-y-5">
          {(orders ?? []).map((order) => {
            const show = Array.isArray(order.shows)
              ? order.shows[0]
              : order.shows;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-stone-800 bg-stone-900 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-stone-500">
                      {order.order_number}
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {order.customer_name}
                    </h2>

                    <p className="text-stone-400">
                      @{order.venmo_username || "not submitted"} ·{" "}
                      {order.customer_email}
                    </p>

                    <p className="mt-2 text-sm text-stone-500">
                      {show?.show_name || "Show"}
                      {show?.show_date
                        ? ` · ${formatDate(show.show_date)}`
                        : ""}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-3xl font-black">
                      {formatCurrency(Number(order.expected_amount))}
                    </p>

                    <span className={getStatusClass(order.status)}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2 border-t border-stone-800 pt-5">
                  {(order.venmo_order_items ?? []).map((item, index) => (
                    <div
                      key={`${item.item_name}-${index}`}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span>
                        {item.quantity} × {item.item_name}
                        {item.item_option
                          ? ` — Size ${item.item_option}`
                          : ""}
                      </span>

                      <span>
                        {formatCurrency(Number(item.line_total))}
                      </span>
                    </div>
                  ))}
                </div>

                {order.status === "pending" ? (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <form action={approveVenmoOrder}>
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.id}
                      />

                      <button className="rounded-lg bg-emerald-600 px-5 py-3 font-black uppercase hover:bg-emerald-500">
                        Approve
                      </button>
                    </form>

                    <form action={declineVenmoOrder}>
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.id}
                      />

                      <button className="rounded-lg border border-red-700 px-5 py-3 font-black uppercase text-red-300 hover:bg-red-950">
                        Decline
                      </button>
                    </form>

                    <form action={deleteVenmoOrder}>
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.id}
                      />

                      <button
                        type="submit"
                        className="rounded-lg border border-stone-700 px-5 py-3 font-black uppercase text-stone-300 hover:border-red-700 hover:text-red-300"
                      >
                        Delete Test Order
                      </button>
                    </form>
                  </div>
                ) : null}

                {order.status === "approved" || order.status === "declined" ? (
                  <div className="mt-6">
                    <form action={deleteVenmoOrder}>
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.id}
                      />

                      <button
                        type="submit"
                        className="rounded-lg border border-stone-700 px-5 py-3 font-black uppercase text-stone-300 hover:border-red-700 hover:text-red-300"
                      >
                        Delete Order
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}

          {(orders ?? []).length === 0 ? (
            <div className="rounded-2xl border border-stone-800 bg-stone-900 p-10 text-center text-stone-500">
              No {formatFilterLabel(activeFilter).toLowerCase()} Venmo orders.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function getSavedMessage(saved: string) {
  switch (saved) {
    case "approved":
      return "Order approved.";
    case "declined":
      return "Order declined.";
    case "deleted":
      return "Venmo order deleted.";
    case "manual":
      return "Manual order created. Review it below, then click Approve.";
    default:
      return `Order ${saved}.`;
  }
}

function formatFilterLabel(filter: OrderFilter) {
  switch (filter) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "all":
      return "All";
  }
}

function getStatusClass(status: string) {
  const base =
    "mt-2 inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase";

  switch (status) {
    case "approved":
      return `${base} border-emerald-800 bg-emerald-950/40 text-emerald-300`;
    case "declined":
      return `${base} border-red-800 bg-red-950/40 text-red-300`;
    default:
      return `${base} border-stone-700 bg-stone-950 text-stone-300`;
  }
}


function AdminField({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3"
      />
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
