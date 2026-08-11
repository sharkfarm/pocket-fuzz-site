import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShowDashboardClient from "@/components/admin/show-dashboard-client";

type ShowsPageProps = {
  searchParams: Promise<{
    deleted?: string;
  }>;
};

export default async function ShowsPage({
  searchParams,
}: ShowsPageProps) {
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [
    { data: shows, error },
    { data: expenses },
    { data: showTerms },
    { data: merchSales },
  ] = await Promise.all([
    supabase
      .from("show_financial_summary")
      .select("*")
      .order("show_date", { ascending: true }),

    supabase
      .from("expenses")
      .select("show_id,actual_amount,reimbursed"),

    supabase
      .from("shows")
      .select(`
        id,
        facility_fee_per_ticket,
        package_expenses,
        deal_base_percent,
        deal_tier_1_threshold,
        deal_tier_1_percent,
        deal_tier_2_threshold,
        deal_tier_2_percent,
        other_income
      `),

    supabase
      .from("merch_sales")
      .select("show_id,quantity_sold,unit_price,unit_cost"),
  ]);

  const outstandingReimbursements = (expenses ?? [])
    .filter((expense) => !expense.reimbursed)
    .reduce(
      (sum, expense) => sum + Number(expense.actual_amount),
      0
    );

  const termsByShow = new Map(
    (showTerms ?? []).map((item) => [item.id, item])
  );

  const expensesByShow = new Map<string, number>();

  for (const expense of expenses ?? []) {
    expensesByShow.set(
      expense.show_id,
      (expensesByShow.get(expense.show_id) ?? 0) +
        Number(expense.actual_amount ?? 0)
    );
  }

  const merchProfitByShow = new Map<string, number>();

  for (const item of merchSales ?? []) {
    const profit =
      Number(item.quantity_sold ?? 0) *
      (Number(item.unit_price ?? 0) - Number(item.unit_cost ?? 0));

    merchProfitByShow.set(
      item.show_id,
      (merchProfitByShow.get(item.show_id) ?? 0) + profit
    );
  }

  const correctedShows = (shows ?? []).map((show) => {
    const terms = termsByShow.get(show.show_id);

    if (!terms) {
      return show;
    }

    const ticketsSold = Number(show.tickets_sold ?? 0);
    const grossTicketRevenue = Number(show.gross_ticket_sales ?? 0);

    const facilityFeePerTicket = Number(
      terms.facility_fee_per_ticket ?? 2
    );

    const packageExpenses = Number(
      terms.package_expenses ?? 250
    );

    const basePercent = Number(
      terms.deal_base_percent ?? 50
    );

    const tier1Threshold = Number(
      terms.deal_tier_1_threshold ?? 50
    );

    const tier1Percent = Number(
      terms.deal_tier_1_percent ?? 60
    );

    const tier2Threshold = Number(
      terms.deal_tier_2_threshold ?? 100
    );

    const tier2Percent = Number(
      terms.deal_tier_2_percent ?? 70
    );

    const payoutRate =
      ticketsSold >= tier2Threshold
        ? tier2Percent / 100
        : ticketsSold >= tier1Threshold
          ? tier1Percent / 100
          : basePercent / 100;

    const payoutBasis = Math.max(
      0,
      grossTicketRevenue -
        ticketsSold * facilityFeePerTicket -
        packageExpenses
    );

    const ticketPayout = payoutBasis * payoutRate;

    const totalExpenses =
      expensesByShow.get(show.show_id) ?? 0;

    const otherIncome = Number(
      terms.other_income ?? 0
    );

    const merchProfit =
      merchProfitByShow.get(show.show_id) ?? 0;

    const ticketNet =
      ticketPayout +
      otherIncome -
      totalExpenses;

    const netShowProfit =
      ticketNet +
      merchProfit;

    return {
      ...show,
      payout_rate: payoutRate,
      ticket_payout: ticketPayout,
      total_expenses: totalExpenses,
      merch_profit: merchProfit,
      net_show_profit: netShowProfit,
    };
  });

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">
              Show Dashboard
            </h1>

            <p className="mt-2 text-sm text-stone-400">
              Signed in as {user.email}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Link
              href="/admin/reports"
              className="rounded-lg border border-stone-700 px-4 py-3 text-center text-sm font-black uppercase hover:border-stone-500"
            >
              Reports
            </Link>

            <Link
              href="/admin/shows/new"
              className="rounded-lg bg-red-600 px-4 py-3 text-center text-sm font-black uppercase hover:bg-red-500"
            >
              Add Show
            </Link>

            <form
              action="/admin/logout"
              method="post"
              className="col-span-2 sm:col-auto"
            >
              <button
                type="submit"
                className="w-full rounded-lg border border-stone-700 px-4 py-3 text-sm font-bold hover:border-stone-500"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {query.deleted === "true" ? (
          <div className="mt-8 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-emerald-200">
            Show permanently deleted.
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            Could not load shows: {error.message}
          </div>
        ) : null}

        <ShowDashboardClient
          shows={correctedShows as never[]}
          outstandingReimbursements={outstandingReimbursements}
        />
      </div>
    </main>
  );
}
