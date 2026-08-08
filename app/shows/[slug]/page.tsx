import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicShowPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: show, error } = await supabase
    .from("shows")
    .select(`
      id,
      show_name,
      show_date,
      doors_time,
      start_time,
      end_time,
      public_slug,
      public_description,
      flyer_url,
      ticket_sales_status,
      venues(name,address,city,state)
    `)
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!show) notFound();

  const venue = Array.isArray(show.venues) ? show.venues[0] : show.venues;
  const ticketsComingSoon = show.ticket_sales_status === "coming_soon";

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/shows" className="text-sm font-bold text-stone-400 hover:text-white">
            ← All Shows
          </Link>
          <Link href="/" className="text-sm font-bold text-stone-400 hover:text-white">
            Pocket Fuzz Home
          </Link>
        </div>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
        <h1 className="mt-3 text-4xl font-black uppercase sm:text-5xl">
          {show.show_name || "Pocket Fuzz Show"}
        </h1>

        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-stone-400">
          <span>{formatDate(show.show_date)}</span>
          {show.start_time ? <><span>·</span><span>{formatTime(show.start_time)}</span></> : null}
          {venue?.name ? <><span>·</span><span>{venue.name}</span></> : null}
        </div>

        {venue ? (
          <p className="mt-2 text-sm text-stone-500">
            {[venue.address, venue.city, venue.state].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        {show.flyer_url ? (
          <img
            src={show.flyer_url}
            alt={show.show_name || "Pocket Fuzz show flyer"}
            className="mt-8 w-full rounded-2xl border border-stone-800 object-cover"
          />
        ) : null}

        {show.public_description ? (
          <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
            <h2 className="text-lg font-black uppercase">About the Show</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-stone-300">{show.public_description}</p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 rounded-2xl border border-stone-800 bg-stone-900 p-6 sm:grid-cols-3">
          <ShowStat label="Doors" value={show.doors_time ? formatTime(show.doors_time) : "TBA"} />
          <ShowStat label="Show" value={show.start_time ? formatTime(show.start_time) : "TBA"} />
          <ShowStat label="Ends" value={show.end_time ? formatTime(show.end_time) : "TBA"} />
        </section>

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          {ticketsComingSoon ? (
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400">Tickets</p>
              <h2 className="mt-3 text-3xl font-black uppercase text-amber-200">Coming Soon</h2>
              <p className="mx-auto mt-4 max-w-xl leading-7 text-stone-400">
                Ticket sales have not opened yet. Check back soon.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">Tickets</p>
                <h2 className="mt-2 text-2xl font-black uppercase">Get Tickets</h2>
                <p className="mt-2 text-stone-400">Purchase tickets for this show using Venmo.</p>
              </div>
              <Link
                href={`/shows/${slug}/buy`}
                className="rounded-lg bg-red-600 px-6 py-4 text-center font-black uppercase tracking-wide text-white hover:bg-red-500"
              >
                Buy Tickets
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ShowStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}
