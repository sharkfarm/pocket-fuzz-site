import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicShow = {
  id: string;
  show_name: string | null;
  show_date: string;
  start_time: string | null;
  public_slug: string | null;
  public_description: string | null;
  flyer_url: string | null;
  status: string;
  venues:
    | {
        name: string | null;
        city: string | null;
        state: string | null;
      }
    | Array<{
        name: string | null;
        city: string | null;
        state: string | null;
      }>
    | null;
};

export default async function PublicShowsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shows")
    .select(`
      id,
      show_name,
      show_date,
      start_time,
      public_slug,
      public_description,
      flyer_url,
      status,
      venues (
        name,
        city,
        state
      )
    `)
    .eq("is_public", true)
    .not("public_slug", "is", null)
    .order("show_date", { ascending: true });

  const shows = (data ?? []) as PublicShow[];

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-16 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-3 text-5xl font-black uppercase">
              Shows
            </h1>
          </div>

          <Link
            href="/"
            className="text-sm font-bold text-stone-400 hover:text-white"
          >
            Pocket Fuzz Home
          </Link>
        </div>

        {error ? (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            Could not load public shows: {error.message}
          </div>
        ) : null}

        {!error && shows.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {shows.map((show) => {
              const venue = Array.isArray(show.venues)
                ? show.venues[0]
                : show.venues;

              return (
                <article
                  key={show.id}
                  className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900"
                >
                  {show.flyer_url ? (
                    <img
                      src={show.flyer_url}
                      alt={show.show_name ?? "Pocket Fuzz show flyer"}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}

                  <div className="p-6">
                    <p className="text-xs font-black uppercase tracking-wide text-stone-500">
                      {show.status}
                    </p>

                    <h2 className="mt-2 text-2xl font-black uppercase">
                      {show.show_name || "Pocket Fuzz Show"}
                    </h2>

                    <p className="mt-2 text-stone-400">
                      {formatDate(show.show_date)} · {formatTime(show.start_time)}
                    </p>

                    {venue?.name ? (
                      <p className="text-stone-400">
                        {venue.name}
                        {venue.city
                          ? ` · ${venue.city}${venue.state ? `, ${venue.state}` : ""}`
                          : ""}
                      </p>
                    ) : null}

                    {show.public_description ? (
                      <p className="mt-4 text-sm leading-6 text-stone-300">
                        {show.public_description}
                      </p>
                    ) : null}

                    <Link
                      href={`/shows/${show.public_slug}`}
                      className="mt-6 inline-flex rounded-lg bg-red-600 px-5 py-3 font-black uppercase text-white hover:bg-red-500"
                    >
                      Tickets & Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!error && shows.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-stone-800 bg-stone-900 p-8 text-stone-400">
            No public shows are currently listed. In the admin dashboard, make
            sure the show has a public slug and “Publish this show on the
            website” is checked.
          </div>
        ) : null}
      </div>
    </main>
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

function formatTime(value: string | null) {
  if (!value) {
    return "Time TBA";
  }

  const [hour, minute] = value.split(":").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}
