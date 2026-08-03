"use client";

import { useMemo, useState } from "react";
import { createShow } from "@/app/admin/shows/new/actions";

type Venue = {
  id: string;
  name: string;
  default_capacity: number | null;
  default_ticket_goal: number | null;
  default_number_of_acts: number | null;
  default_doors_time: string | null;
  default_start_time: string | null;
  default_end_time: string | null;
  radius_clause_weeks: number | null;
  radius_clause_miles: number | null;
  food_discount_percent: number | string | null;
  meals_included_ticket_threshold: number | null;
};

type Member = {
  id: string;
  name: string;
  default_split_percent: number | string;
};

export default function NewShowForm({ venues, members }: { venues: Venue[]; members: Member[] }) {
  const [venueId, setVenueId] = useState("");
  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === venueId),
    [venueId, venues]
  );

  const totalSplit = members.reduce(
    (sum, member) => sum + Number(member.default_split_percent || 0),
    0
  );

  const timeValue = (value: string | null | undefined, fallback: string) =>
    value ? value.slice(0, 5) : fallback;

  return (
    <form action={createShow} className="space-y-8 rounded-2xl border border-stone-800 bg-stone-900 p-6 md:p-8">
      <section>
        <h2 className="mb-5 text-lg font-black uppercase">Show Information</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Show Name" name="show_name" placeholder="Pocket Fuzz at Globe Hall" />

          <div>
            <label htmlFor="venue_id" className="mb-2 block text-sm font-semibold">Venue</label>
            <select
              id="venue_id"
              name="venue_id"
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
            >
              <option value="">Select a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-stone-500">Manage venue defaults under Admin → Venues.</p>
          </div>

          <Field label="Show Date" name="show_date" type="date" required />
          <Field label="Capacity" name="capacity" type="number" min="1" required key={`capacity-${venueId}`} defaultValue={String(selectedVenue?.default_capacity ?? 300)} />
          <Field label="Ticket Goal" name="ticket_goal" type="number" min="0" key={`goal-${venueId}`} defaultValue={String(selectedVenue?.default_ticket_goal ?? 50)} />
          <Field label="Number of Acts" name="number_of_acts" type="number" min="1" key={`acts-${venueId}`} defaultValue={String(selectedVenue?.default_number_of_acts ?? 3)} />
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-lg font-black uppercase">Schedule</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Doors" name="doors_time" type="time" key={`doors-${venueId}`} defaultValue={timeValue(selectedVenue?.default_doors_time, "19:00")} />
          <Field label="Show Starts" name="start_time" type="time" key={`start-${venueId}`} defaultValue={timeValue(selectedVenue?.default_start_time, "20:00")} />
          <Field label="Show Ends" name="end_time" type="time" key={`end-${venueId}`} defaultValue={timeValue(selectedVenue?.default_end_time, "00:00")} />
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-lg font-black uppercase">Venue Terms</h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Radius Clause Weeks" name="radius_clause_weeks" type="number" min="0" key={`rw-${venueId}`} defaultValue={String(selectedVenue?.radius_clause_weeks ?? 4)} />
          <Field label="Radius Clause Miles" name="radius_clause_miles" type="number" min="0" key={`rm-${venueId}`} defaultValue={String(selectedVenue?.radius_clause_miles ?? 20)} />
          <Field label="Food Discount %" name="food_discount_percent" type="number" min="0" step="0.01" key={`fd-${venueId}`} defaultValue={String(selectedVenue?.food_discount_percent ?? 40)} />
          <Field label="Meals Included At" name="meals_included_ticket_threshold" type="number" min="0" key={`mt-${venueId}`} defaultValue={String(selectedVenue?.meals_included_ticket_threshold ?? 50)} />
        </div>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-950 p-5">
        <h2 className="font-black uppercase">Band payout setup</h2>
        <p className="mt-2 text-sm text-stone-400">Active roster members will be added automatically using their default split percentages.</p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {members.map((member) => (
            <p key={member.id}>{member.name}: {Number(member.default_split_percent).toFixed(2)}%</p>
          ))}
        </div>
        <p className={`mt-4 text-sm font-bold ${Math.abs(totalSplit - 100) < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>
          Total default split: {totalSplit.toFixed(2)}%
        </p>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-950 p-5">
        <h2 className="font-black uppercase">Website listing</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-stone-700 px-4 py-3">
            <input type="checkbox" name="is_public" />
            <span className="font-semibold">Publish this show on the website</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-stone-700 px-4 py-3">
            <input type="checkbox" name="featured" />
            <span className="font-semibold">Feature this show</span>
          </label>
          <Field label="Public URL Slug" name="public_slug" placeholder="globe-hall-aug-9" />
          <Field label="Flyer Image URL" name="flyer_url" placeholder="https://.../flyer.jpg" />
          <div className="md:col-span-2">
            <label htmlFor="public_description" className="mb-2 block text-sm font-semibold">Public Description</label>
            <textarea id="public_description" name="public_description" rows={4} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500" placeholder="Public-facing show description..." />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-950 p-5">
        <h2 className="font-black uppercase">Default ticket prices</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Offline Presale" name="offline_price" type="number" min="0" step="0.01" defaultValue="12" />
          <Field label="Online" name="online_price" type="number" min="0" step="0.01" defaultValue="12" />
          <Field label="Door" name="door_price" type="number" min="0" step="0.01" defaultValue="15" />
          <Field label="Reserved Table" name="reserved_price" type="number" min="0" step="0.01" defaultValue="18" />
        </div>
      </section>

      <button type="submit" className="w-full rounded-lg bg-red-600 px-5 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500">Create Show</button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  min?: string;
  step?: string;
  required?: boolean;
};

function Field({ label, name, type = "text", placeholder, defaultValue, min, step, required = false }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>
      <input id={name} name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} min={min} step={step} required={required} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500" />
    </div>
  );
}
