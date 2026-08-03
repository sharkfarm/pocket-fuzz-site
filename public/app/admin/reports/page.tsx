import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ShowSummary = {
  show_id: string;
  show_name: string | null;
  show_date: string;
  venue_name: string | null;
  status: string;
  tickets_sold: number;
  ticket_payout: number | string;
  merch_profit: number | string;
  total_expenses: number | string;
  net_show_profit: number | string;
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data, error } = await supabase
    .from("show_financial_summary")
    .select("*")
    .order("show_date", { ascending: false });

  const shows = (data ?? []) as ShowSummary[];
  const completed = shows.filter((show) => show.status === "completed");

  const totalPayout = completed.reduce((sum, show) => sum + Number(show.ticket_payout), 0);
  const totalMerchProfit = completed.reduce((sum, show) => sum + Number(show.merch_profit), 0);
  const totalExpenses = completed.reduce((sum, show) => sum + Number(show.total_expenses), 0);
  const totalNet = completed.reduce((sum, show) => sum + Number(show.net_show_profit), 0);
  const averageAttendance = completed.length
    ? completed.reduce((sum, show) => sum + Number(show.tickets_sold), 0) / completed.length
    : 0;

  const venueTotals = completed.reduce<Record<string, number>>((totals, show) => {
    const venue = show.venue_name || "Unknown venue";
    totals[venue] = (totals[venue] ?? 0) + Number(show.net_show_profit);
    return totals;
  }, {});

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
            <h1 className="mt-2 text-4xl font-black uppercase">Reports</h1>
          </div>
          <Link href="/admin/shows" className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold">
            Back to Shows
          </Link>
        </div>

        {error ? (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            Could not load reports: {error.message}
          </div>
        ) : null}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Completed Shows" value={String(completed.length)} />
          <Metric label="Ticket Payout" value={formatCurrency(totalPayout)} />
          <Metric label="Merch Profit" value={formatCurrency(totalMerchProfit)} />
          <Metric label="Expenses" value={formatCurrency(totalExpenses)} />
          <Metric label="Net Profit" value={formatCurrency(totalNet)} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-xl font-black uppercase">Performance</h2>
            <div className="mt-5 space-y-4">
              <Row label="Average attendance" value={averageAttendance.toFixed(1)} />
              <Row label="Average net per completed show" value={formatCurrency(completed.length ? totalNet / completed.length : 0)} />
            </div>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-xl font-black uppercase">Profit by Venue</h2>
            <div className="mt-5 space-y-4">
              {Object.entries(venueTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([venue, total]) => <Row key={venue} label={venue} value={formatCurrency(total)} />)}
              {Object.keys(venueTotals).length === 0 ? <p className="text-stone-500">No completed shows yet.</p> : null}
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
          <div className="border-b border-stone-800 px-6 py-5">
            <h2 className="text-xl font-black uppercase">Completed Shows</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-stone-950 text-xs uppercase text-stone-500">
                <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Show</th><th className="px-6 py-4">Tickets</th><th className="px-6 py-4">Payout</th><th className="px-6 py-4">Net</th></tr>
              </thead>
              <tbody>
                {completed.map((show) => (
                  <tr key={show.show_id} className="border-t border-stone-800">
                    <td className="px-6 py-5">{show.show_date}</td>
                    <td className="px-6 py-5"><Link className="font-bold hover:text-red-400" href={`/admin/shows/${show.show_id}`}>{show.show_name || "Untitled Show"}</Link><p className="text-sm text-stone-500">{show.venue_name || "Venue not set"}</p></td>
                    <td className="px-6 py-5">{show.tickets_sold}</td>
                    <td className="px-6 py-5">{formatCurrency(Number(show.ticket_payout))}</td>
                    <td className="px-6 py-5 font-bold">{formatCurrency(Number(show.net_show_profit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-stone-800 bg-stone-900 p-5"><p className="text-xs font-bold uppercase text-stone-500">{label}</p><p className="mt-3 text-2xl font-black">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-stone-800 pb-3 last:border-0"><span className="text-stone-400">{label}</span><span className="font-bold">{value}</span></div>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
