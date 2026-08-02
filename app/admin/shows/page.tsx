import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ShowSummary = {
  show_id: string;
  show_name: string | null;
  show_date: string;
  status: string;
  venue_name: string | null;
  tickets_sold: number;
  gross_ticket_sales: number | string;
  payout_rate: number | string;
  ticket_payout: number | string;
  net_show_profit: number | string;
  capacity_percent: number | string;
};

export default async function ShowsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data, error } = await supabase
    .from("show_financial_summary")
    .select("*")
    .order("show_date", { ascending: true });

  const shows = (data ?? []) as ShowSummary[];

  const upcomingShows = shows.filter(
    (show) => show.status === "upcoming"
  );

  const totalProjectedPayout = upcomingShows.reduce(
    (total, show) => total + Number(show.ticket_payout),
    0
  );

  const totalTickets = upcomingShows.reduce(
    (total, show) => total + Number(show.tickets_sold),
    0
  );

  const totalNetProfit = shows
    .filter((show) => show.status === "completed")
    .reduce(
      (total, show) => total + Number(show.net_show_profit),
      0
    );

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-2 text-4xl font-black uppercase">
              Show Dashboard
            </h1>

            <p className="mt-2 text-sm text-stone-400">
              Signed in as {user.email}
            </p>
          </div>

          <div className="flex gap-3">
            <form action="/admin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-stone-700 px-4 py-3 text-sm font-bold hover:border-stone-500"
              >
                Sign Out
              </button>
            </form>

            <Link
              href="/admin/shows/new"
              className="rounded-lg bg-red-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-red-500"
            >
              Add Show
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            Could not load shows: {error.message}
          </div>
        ) : null}

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Upcoming Shows"
            value={String(upcomingShows.length)}
          />

          <SummaryCard
            label="Upcoming Tickets Sold"
            value={String(totalTickets)}
          />

          <SummaryCard
            label="Projected Payout"
            value={formatCurrency(totalProjectedPayout)}
          />

          <SummaryCard
            label="Completed Show Profit"
            value={formatCurrency(totalNetProfit)}
          />
        </section>

        <section className="mt-10 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">
              Shows
            </h2>
          </div>

          {shows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h3 className="text-xl font-bold">
                No shows yet
              </h3>

              <p className="mt-2 text-stone-400">
                Add your first show to begin tracking tickets,
                payouts, expenses, and profit.
              </p>

              <Link
                href="/admin/shows/new"
                className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 font-black uppercase text-white hover:bg-red-500"
              >
                Add First Show
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-stone-950 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Show</th>
                    <th className="px-6 py-4">Tickets</th>
                    <th className="px-6 py-4">Gross</th>
                    <th className="px-6 py-4">Payout</th>
                    <th className="px-6 py-4">Net</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {shows.map((show) => (
                    <tr
                      key={show.show_id}
                      className="border-t border-stone-800 hover:bg-stone-800/50"
                    >
                      <td className="px-6 py-5">
                        {formatDate(show.show_date)}
                      </td>

                      <td className="px-6 py-5">
                        <Link
                          href={`/admin/shows/${show.show_id}`}
                          className="inline-block font-bold text-stone-100 underline decoration-stone-600 underline-offset-4 hover:text-red-400"
                        >
                          {show.show_name || "Untitled Show"}
                        </Link>

                        <p className="mt-1 text-sm text-stone-500">
                          {show.venue_name || "Venue not set"}
                        </p>

                        <p className="mt-1 text-xs text-stone-600">
                         ID: {show.show_id}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        {show.tickets_sold}
                      </td>

                      <td className="px-6 py-5">
                        {formatCurrency(
                          Number(show.gross_ticket_sales)
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <p>
                          {formatCurrency(
                            Number(show.ticket_payout)
                          )}
                        </p>

                        <p className="text-xs text-stone-500">
                          {Math.round(
                            Number(show.payout_rate) * 100
                          )}
                          %
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        {formatCurrency(
                          Number(show.net_show_profit)
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-full border border-stone-700 px-3 py-1 text-xs font-bold uppercase">
                          {show.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900 p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black">
        {value}
      </p>
    </div>
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