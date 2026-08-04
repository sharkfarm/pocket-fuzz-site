import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createVenue, deleteVenue, updateVenue } from "./actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string; q?: string }>;
};

type Venue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  website: string | null;
  booking_email: string | null;
  phone: string | null;
  contact_name: string | null;
  default_capacity: number | null;
  typical_payout: number | string | null;
  indoor_outdoor: string | null;
  food_terms: string | null;
  drink_terms: string | null;
  sound_system: string | null;
  lighting: string | null;
  stage_notes: string | null;
  parking_notes: string | null;
  load_in_notes: string | null;
  booking_notes: string | null;
  rating: number | null;
  favorite: boolean;
  active: boolean;
};

export default async function VenuesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const search = String(query.q ?? "").trim();
  let venueQuery = supabase
    .from("venues")
    .select("*")
    .order("favorite", { ascending: false })
    .order("name", { ascending: true });

  if (search) {
    venueQuery = venueQuery.or(
      `name.ilike.%${search}%,city.ilike.%${search}%,booking_email.ilike.%${search}%,contact_name.ilike.%${search}%`
    );
  }

  const { data, error } = await venueQuery;
  const venues = (data ?? []) as Venue[];

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
            <h1 className="mt-2 text-4xl font-black uppercase">Venues</h1>
            <p className="mt-2 text-sm text-stone-400">Booking contacts, production notes, capacities, and typical deal terms.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/shows/new" className="rounded-lg bg-red-600 px-5 py-3 text-sm font-black uppercase hover:bg-red-500">Add Show</Link>
            <Link href="/admin/shows" className="rounded-lg border border-stone-700 px-5 py-3 text-sm font-bold hover:border-stone-500">Back to Shows</Link>
          </div>
        </header>

        {query.saved ? (
          <div className="mt-7 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-200">
            Venue {query.saved}.
          </div>
        ) : null}

        {query.error || error ? (
          <div className="mt-7 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">
            {query.error ?? error?.message}
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">Add Venue</h2>
          <VenueForm action={createVenue} submitLabel="Add Venue" />
        </section>

        <form className="mt-8 flex max-w-xl gap-3">
          <input name="q" defaultValue={search} placeholder="Search venues, cities, contacts..." className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 outline-none focus:border-red-500" />
          <button className="rounded-lg border border-stone-700 px-5 py-3 font-bold hover:border-stone-500">Search</button>
          {search ? <Link href="/admin/venues" className="rounded-lg border border-stone-700 px-5 py-3 font-bold hover:border-stone-500">Clear</Link> : null}
        </form>

        <section className="mt-8 space-y-5">
          {venues.map((venue) => (
            <details key={venue.id} className="group rounded-2xl border border-stone-800 bg-stone-900">
              <summary className="cursor-pointer list-none p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">{venue.name}</h2>
                      {venue.favorite ? <Badge text="Favorite" /> : null}
                      {!venue.active ? <Badge text="Inactive" muted /> : null}
                    </div>
                    <p className="mt-2 text-stone-400">{formatAddress(venue)}</p>
                    <p className="mt-2 text-sm text-stone-500">
                      {venue.contact_name || "No booking contact"}
                      {venue.booking_email ? ` · ${venue.booking_email}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm sm:text-right">
                    <Stat label="Capacity" value={venue.default_capacity === null ? "—" : String(venue.default_capacity)} />
                    <Stat label="Typical Payout" value={venue.typical_payout === null ? "—" : formatCurrency(Number(venue.typical_payout))} />
                  </div>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-stone-500 group-open:hidden">Open venue details</p>
              </summary>

              <div className="border-t border-stone-800 p-6">
                <VenueForm action={updateVenue} submitLabel="Save Venue" venue={venue} />
                <div className="mt-8 border-t border-red-950 pt-6">
                  <h3 className="font-black uppercase text-red-400">Delete Venue</h3>
                  <p className="mt-2 text-sm text-stone-500">A venue attached to a show cannot be deleted. Mark it inactive instead.</p>
                  <form action={deleteVenue} className="mt-4">
                    <input type="hidden" name="venue_id" value={venue.id} />
                    <button className="rounded-lg border border-red-900 px-5 py-3 text-sm font-black uppercase text-red-400 hover:bg-red-950/40">Delete Unused Venue</button>
                  </form>
                </div>
              </div>
            </details>
          ))}
          {venues.length === 0 ? <div className="rounded-2xl border border-stone-800 bg-stone-900 p-10 text-center text-stone-500">No venues found.</div> : null}
        </section>
      </div>
    </main>
  );
}

function VenueForm({
  action,
  submitLabel,
  venue,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  venue?: Venue;
}) {
  return (
    <form action={action} className="mt-6 space-y-7">
      {venue ? <input type="hidden" name="venue_id" value={venue.id} /> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Venue Name" name="name" value={venue?.name} required />
        <Field label="Contact Name" name="contact_name" value={venue?.contact_name} />
        <Field label="Booking Email" name="booking_email" type="email" value={venue?.booking_email} />
        <Field label="Phone" name="phone" type="tel" value={venue?.phone} />
        <Field label="Website" name="website" type="url" value={venue?.website} placeholder="https://..." />
        <Field label="Address" name="address" value={venue?.address} />
        <Field label="City" name="city" value={venue?.city} />
        <Field label="State" name="state" value={venue?.state} placeholder="CO" />
        <Field label="ZIP" name="postal_code" value={venue?.postal_code} />
        <Field label="Capacity" name="default_capacity" type="number" min="0" step="1" value={venue?.default_capacity} />
        <Field label="Typical Payout" name="typical_payout" type="number" min="0" step="0.01" value={venue?.typical_payout} />

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Setting</span>
          <select name="indoor_outdoor" defaultValue={venue?.indoor_outdoor ?? ""} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
            <option value="">Not specified</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="both">Indoor / Outdoor</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Rating</span>
          <select name="rating" defaultValue={venue?.rating ? String(venue.rating) : ""} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3">
            <option value="">Not rated</option>
            {[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Area label="Food Terms" name="food_terms" value={venue?.food_terms} />
        <Area label="Drink Terms" name="drink_terms" value={venue?.drink_terms} />
        <Area label="Sound System" name="sound_system" value={venue?.sound_system} />
        <Area label="Lighting" name="lighting" value={venue?.lighting} />
        <Area label="Stage Notes" name="stage_notes" value={venue?.stage_notes} />
        <Area label="Load-in Notes" name="load_in_notes" value={venue?.load_in_notes} />
        <Area label="Parking Notes" name="parking_notes" value={venue?.parking_notes} />
        <Area label="Booking Notes" name="booking_notes" value={venue?.booking_notes} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <Check label="Favorite venue" name="favorite" checked={venue?.favorite} />
          {venue ? <Check label="Active" name="active" checked={venue.active} /> : null}
        </div>
        <button className="rounded-lg bg-red-600 px-6 py-3 font-black uppercase hover:bg-red-500">{submitLabel}</button>
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", value, placeholder, min, step, required = false }: {
  label: string; name: string; type?: string; value?: string | number | null;
  placeholder?: string; min?: string; step?: string; required?: boolean;
}) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} min={min} step={step} required={required} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500" /></label>;
}

function Area({ label, name, value }: { label: string; name: string; value?: string | null }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><textarea name={name} rows={3} defaultValue={value ?? ""} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500" /></label>;
}

function Check({ label, name, checked = false }: { label: string; name: string; checked?: boolean }) {
  return <label className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3"><input type="checkbox" name={name} defaultChecked={checked} /><span className="text-sm font-semibold">{label}</span></label>;
}

function Badge({ text, muted = false }: { text: string; muted?: boolean }) {
  return <span className={muted ? "rounded-full border border-stone-700 px-3 py-1 text-xs font-black uppercase text-stone-400" : "rounded-full border border-amber-700 bg-amber-950/40 px-3 py-1 text-xs font-black uppercase text-amber-300"}>{text}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase text-stone-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function formatAddress(venue: Venue) {
  const locality = [venue.city, venue.state].filter(Boolean).join(", ");
  return [venue.address, locality, venue.postal_code].filter(Boolean).join(" · ") || "Address not entered";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
