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

  const [{ data: shows, error }, { data: expenses }] = await Promise.all([
    supabase
      .from("show_financial_summary")
      .select("*")
      .order("show_date", { ascending: true }),

    supabase
      .from("expenses")
      .select("actual_amount,reimbursed"),
  ]);

  const outstandingReimbursements = (expenses ?? [])
    .filter((expense) => !expense.reimbursed)
    .reduce(
      (sum, expense) => sum + Number(expense.actual_amount),
      0
    );

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
          shows={(shows ?? []) as never[]}
          outstandingReimbursements={outstandingReimbursements}
        />
      </div>
    </main>
  );
}
