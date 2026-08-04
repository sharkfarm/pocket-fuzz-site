import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createVenmoOrder } from "./buy/actions";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function PublicShowPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: show, error: showError } = await supabase
    .from("shows")
    .select(`
      id,
      show_name,
      show_date,
      start_time,
      public_slug,
      public_description,
      flyer_url,
      venues(name,address,city,state)
    `)
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (showError) {
    throw new Error(showError.message);
  }

  if (!show) {
    notFound();
  }

  const { data: tickets, error: ticketError } = await supabase
   .from("ticket_sales")
    .select("id,ticket_type,ticket_price,channel")
    .eq("show_id", show.id)
    .order("created_at");

  if (ticketError) {
    throw new Error(ticketError.message);
  }
    
  const venue = Array.isArray(show.venues) ? show.venues[0] : show.venues;

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-stone-100">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
        <h1 className="mt-3 text-4xl font-black uppercase">{show.show_name || "Pocket Fuzz Show"}</h1>
        <p className="mt-3 text-stone-400">
          {formatDate(show.show_date)}
          {show.start_time ? ` · ${formatTime(show.start_time)}` : ""}
          {venue?.name ? ` · ${venue.name}` : ""}
        </p>

        {show.flyer_url ? (
          <img
            src={show.flyer_url}
            alt={show.show_name || "Pocket Fuzz show flyer"}
            className="mt-8 w-full rounded-2xl border border-stone-800 object-cover"
          />
        ) : null}

        {show.public_description ? (
          <p className="mt-6 max-w-2xl text-stone-300">{show.public_description}</p>
        ) : null}

        {query.error ? (
          <div className="mt-8 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            {query.error}
          </div>
        ) : null}

        <form action={createVenmoOrder} className="mt-10 space-y-8 rounded-2xl border border-stone-800 bg-stone-900 p-6 md:p-8">
          <input type="hidden" name="show_id" value={show.id} />
          <input type="hidden" name="slug" value={slug} />

          <section>
            <h2 className="text-xl font-black uppercase">Tickets</h2>
            <div className="mt-4 space-y-3">
              {(tickets ?? []).map((ticket) => (
                <OrderRow
                  key={ticket.id}
                  name={`ticket_${ticket.id}`}
                  label={ticket.ticket_type}
                  price={Number(ticket.ticket_price)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase">Your Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Name" name="customer_name" required />
              <Field label="Email" name="customer_email" type="email" required />
              <Field label="Phone" name="customer_phone" type="tel" />
            </div>
          </section>

          <button type="submit" className="w-full rounded-lg bg-red-600 px-6 py-4 font-black uppercase tracking-wide hover:bg-red-500">
            Continue to Venmo
          </button>

          <p className="text-center text-xs text-stone-500">
            Your selections are saved before Venmo opens, so you will not need to enter them again.
          </p>
        </form>
      </div>
    </main>
  );
}

function OrderRow({
  name,
  label,
  price,
}: {
  name: string;
  label: string;
  price: number;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-bold">{label}</span>

        <span className="flex items-center gap-4">
          <strong>{formatCurrency(price)}</strong>

          <input
            name={name}
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-20 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2"
          />
        </span>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input name={name} type={type} required={required} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3" />
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hour, minute));
}
