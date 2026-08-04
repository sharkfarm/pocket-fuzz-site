import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const cards = [
  {
    href: "/admin/shows",
    title: "Shows",
    description: "Create shows, manage ticket deals, expenses, payouts, and settlement.",
  },
  {
    href: "/admin/venues",
    title: "Venues",
    description: "Manage venue contacts, capacities, production notes, and ticket defaults.",
  },
  {
    href: "/admin/venmo",
    title: "Venmo Orders",
    description: "Review, approve, decline, and filter ticket and merchandise orders.",
  },
  {
    href: "/admin/merchandise",
    title: "Merchandise",
    description: "Review merchandise sales separately from venue ticket revenue.",
  },
  {
    href: "/admin/inventory",
    title: "Inventory",
    description: "Track shirts, sizes, stickers, buttons, and low-stock items.",
  },
  {
    href: "/admin/reports",
    title: "Reports",
    description: "Review show profitability, payouts, expenses, and reimbursements.",
  },
  {
    href: "/admin/media",
    title: "Media",
    description: "Manage flyers, band photos, logos, stage plots, and press files.",
  },
  {
    href: "/admin/website",
    title: "Website",
    description: "Manage public-facing shows and website content.",
  },
  {
    href: "/admin/settings",
    title: "Settings",
    description: "Manage band, payment, ticket, and application defaults.",
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [
    { count: upcomingShows },
    { count: pendingOrders },
    { count: activeVenues },
  ] = await Promise.all([
    supabase
      .from("shows")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "upcoming"]),
    supabase
      .from("venmo_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "submitted"]),
    supabase
      .from("venues")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
          Pocket Fuzz
        </p>

        <h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">
          Admin Dashboard
        </h1>

        <p className="mt-3 text-stone-400">
          Signed in as {user.email}
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metric label="Upcoming Shows" value={String(upcomingShows ?? 0)} />
          <Metric label="Pending Venmo Orders" value={String(pendingOrders ?? 0)} />
          <Metric label="Active Venues" value={String(activeVenues ?? 0)} />
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-stone-800 bg-stone-900 p-6 transition hover:-translate-y-0.5 hover:border-red-800"
            >
              <h2 className="text-2xl font-black uppercase group-hover:text-red-400">
                {card.title}
              </h2>

              <p className="mt-3 leading-6 text-stone-400">
                {card.description}
              </p>

              <p className="mt-6 text-sm font-black uppercase tracking-wide text-red-500">
                Open →
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">Quick Actions</h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <QuickLink href="/admin/shows/new" label="Add Show" />
            <QuickLink href="/admin/venues" label="Add Venue" />
            <QuickLink href="/admin/venmo?status=submitted" label="Review Payments" />
            <QuickLink href="/" label="Open Main Website" external />
            <QuickLink href="/shows" label="Open Public Shows" external />
          </div>
        </section>
      </div>
    </main>
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
      <p className="mt-2 text-4xl font-black">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="rounded-lg border border-stone-700 px-4 py-3 text-sm font-black uppercase hover:border-red-700 hover:text-red-300"
    >
      {label}
    </Link>
  );
}
