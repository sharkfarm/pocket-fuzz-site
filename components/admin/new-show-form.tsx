"use client";

import Link from "next/link";
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
  city?: string | null;
  state?: string | null;
  contact_name?: string | null;
  booking_email?: string | null;
  facility_fee_per_ticket?: number | string | null;
  package_expenses?: number | string | null;
  deal_base_percent?: number | string | null;
  deal_tier_1_threshold?: number | null;
  deal_tier_1_percent?: number | string | null;
  deal_tier_2_threshold?: number | null;
  deal_tier_2_percent?: number | string | null;
  venue_ticket_defaults?: Array<{
    id: string;
    ticket_type: string;
    channel: string;
    ticket_price: number | string;
    display_order: number;
    active: boolean;
  }>;
};

type Member = {
  id: string;
  name: string;
  default_split_percent: number | string;
};

export default function NewShowForm({ venues, members }: { venues: Venue[]; members: Member[] }) {
  const [venueId, setVenueId] = useState("");
  const [showDate, setShowDate] = useState("");
  const [showName, setShowName] = useState("");
  const [showNameEdited, setShowNameEdited] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === venueId),
    [venueId, venues]
  );

  const suggestedShowName = selectedVenue
    ? `Pocket Fuzz at ${selectedVenue.name}`
    : "";

  const suggestedSlug = selectedVenue && showDate
    ? slugify(`${selectedVenue.name}-${showDate}`)
    : "";

  const handleVenueChange = (nextVenueId: string) => {
    setVenueId(nextVenueId);

    const nextVenue = venues.find((venue) => venue.id === nextVenueId);

    if (!showNameEdited) {
      setShowName(nextVenue ? `Pocket Fuzz at ${nextVenue.name}` : "");
    }

    if (!slugEdited && nextVenue && showDate) {
      setPublicSlug(slugify(`${nextVenue.name}-${showDate}`));
    }
  };

  const handleDateChange = (nextDate: string) => {
    setShowDate(nextDate);

    if (!slugEdited && selectedVenue && nextDate) {
      setPublicSlug(slugify(`${selectedVenue.name}-${nextDate}`));
    }
  };

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
          <Field
            label="Show Name"
            name="show_name"
            placeholder="Pocket Fuzz at Globe Hall"
            value={showName}
            onChange={(value) => {
              setShowName(value);
              setShowNameEdited(value !== suggestedShowName);
            }}
          />

          <div>
            <label htmlFor="venue_id" className="mb-2 block text-sm font-semibold">Venue</label>
            <select
              id="venue_id"
              name="venue_id"
              value={venueId}
              onChange={(event) => handleVenueChange(event.target.value)}
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
            >
              <option value="">Select a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="text-xs text-stone-500">
                Venue defaults populate automatically.
              </p>

              <Link
                href="/admin/venues"
                target="_blank"
                className="text-xs font-bold text-red-400 hover:text-red-300"
              >
                + Add New Venue
              </Link>
            </div>
          </div>

          <Field
            label="Show Date"
            name="show_date"
            type="date"
            required
            value={showDate}
            onChange={handleDateChange}
          />
          <Field label="Capacity" name="capacity" type="number" min="1" required key={`capacity-${venueId}`} defaultValue={String(selectedVenue?.default_capacity ?? 300)} />
          <Field label="Ticket Goal" name="ticket_goal" type="number" min="0" key={`goal-${venueId}`} defaultValue={String(selectedVenue?.default_ticket_goal ?? 50)} />
          <Field label="Number of Acts" name="number_of_acts" type="number" min="1" key={`acts-${venueId}`} defaultValue={String(selectedVenue?.default_number_of_acts ?? 3)} />
        </div>

        {selectedVenue ? (
          <div className="mt-5 rounded-xl border border-stone-800 bg-stone-950 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-400">
                  Selected Venue
                </p>

                <h3 className="mt-1 text-xl font-black">
                  {selectedVenue.name}
                </h3>

                {selectedVenue.city ? (
                  <p className="mt-1 text-sm text-stone-500">
                    {selectedVenue.city}
                    {selectedVenue.state ? `, ${selectedVenue.state}` : ""}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:text-right">
                <VenueStat
                  label="Capacity"
                  value={String(selectedVenue.default_capacity ?? 300)}
                />

                <VenueStat
                  label="Radius"
                  value={`${selectedVenue.radius_clause_miles ?? 20} mi / ${selectedVenue.radius_clause_weeks ?? 4} wk`}
                />

                <VenueStat
                  label="Food"
                  value={`${Number(selectedVenue.food_discount_percent ?? 40)}% off`}
                />

                <VenueStat
                  label="Meals"
                  value={`At ${selectedVenue.meals_included_ticket_threshold ?? 50} tickets`}
                />
              </div>
            </div>
          </div>
        ) : null}
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
          <Field
            label="Public URL Slug"
            name="public_slug"
            placeholder="globe-hall-2026-08-09"
            value={publicSlug}
            onChange={(value) => {
              setPublicSlug(slugify(value));
              setSlugEdited(value !== suggestedSlug);
            }}
          />
          <div>
            <label htmlFor="flyer_file" className="mb-2 block text-sm font-semibold">
              Flyer Image
            </label>
            <input
              id="flyer_file"
              name="flyer_file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 text-sm file:mr-4 file:rounded file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-red-500"
            />
            <p className="mt-2 text-xs text-stone-500">
              PNG, JPG, WEBP, or GIF. The file uploads to the public show-flyers bucket.
            </p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="public_description" className="mb-2 block text-sm font-semibold">Public Description</label>
            <textarea id="public_description" name="public_description" rows={4} className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500" placeholder="Public-facing show description..." />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-800 bg-stone-950 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-black uppercase">Venue Ticket Setup</h2>
            <p className="mt-2 text-sm text-stone-400">
              These admission types come from the selected venue. Prices can be
              overridden for this show without changing the venue template.
              Merchandise is managed separately after the show is created.
            </p>
          </div>
          <Link
            href="/admin/venues"
            target="_blank"
            className="text-xs font-bold uppercase text-red-400 hover:text-red-300"
          >
            Edit Venue Defaults →
          </Link>
        </div>

        {selectedVenue ? (
          <div className="mt-5 rounded-xl border border-stone-800 bg-stone-900/60 p-5">
            <h3 className="font-black uppercase">Deal Terms</h3>
            <p className="mt-2 text-sm text-stone-400">
              Payout is calculated after the per-ticket facility fee and package expenses.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Facility Fee / Ticket" name="facility_fee_per_ticket" type="number" min="0" step="0.01" key={`facility-${venueId}`} defaultValue={String(selectedVenue.facility_fee_per_ticket ?? 2)} />
              <Field label="Package Expenses" name="package_expenses" type="number" min="0" step="0.01" key={`package-${venueId}`} defaultValue={String(selectedVenue.package_expenses ?? 250)} />
              <Field label="Base Deal %" name="deal_base_percent" type="number" min="0" step="0.01" key={`base-${venueId}`} defaultValue={String(selectedVenue.deal_base_percent ?? 50)} />
              <Field label="Tier 1 Tickets" name="deal_tier_1_threshold" type="number" min="0" step="1" key={`t1t-${venueId}`} defaultValue={String(selectedVenue.deal_tier_1_threshold ?? 50)} />
              <Field label="Tier 1 Deal %" name="deal_tier_1_percent" type="number" min="0" step="0.01" key={`t1p-${venueId}`} defaultValue={String(selectedVenue.deal_tier_1_percent ?? 60)} />
              <Field label="Tier 2 Tickets" name="deal_tier_2_threshold" type="number" min="0" step="1" key={`t2t-${venueId}`} defaultValue={String(selectedVenue.deal_tier_2_threshold ?? 100)} />
              <Field label="Tier 2 Deal %" name="deal_tier_2_percent" type="number" min="0" step="0.01" key={`t2p-${venueId}`} defaultValue={String(selectedVenue.deal_tier_2_percent ?? 70)} />
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-300">
              50% after $2.00 per-ticket facility fees and $250 package expenses; 60% after 50 tickets; 70% after 100 tickets.
            </p>
          </div>
        ) : null}

        {selectedVenue ? (
          (selectedVenue.venue_ticket_defaults ?? [])
            .filter((ticket) => ticket.active)
            .sort((a, b) => a.display_order - b.display_order).length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(selectedVenue.venue_ticket_defaults ?? [])
                .filter((ticket) => ticket.active)
                .sort((a, b) => a.display_order - b.display_order)
                .map((ticket) => (
                  <div key={ticket.id}>
                    <input type="hidden" name="ticket_default_id" value={ticket.id} />
                    <input type="hidden" name={`ticket_type_${ticket.id}`} value={ticket.ticket_type} />
                    <input type="hidden" name={`ticket_channel_${ticket.id}`} value={ticket.channel} />
                    <Field
                      label={`${ticket.ticket_type} (${ticket.channel})`}
                      name={`ticket_price_${ticket.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={String(ticket.ticket_price)}
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
              This venue has no ticket template yet. Standard ticket types will
              be used for this show.
            </div>
          )
        ) : (
          <p className="mt-5 text-sm text-stone-500">
            Select a venue to load its ticket types and prices.
          </p>
        )}
      </section>

      <div className="rounded-xl border border-stone-800 bg-stone-950 p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <ReadyItem label="Venue" ready={Boolean(venueId)} />
          <ReadyItem label="Date" ready={Boolean(showDate)} />
          <ReadyItem label="Show Name" ready={Boolean(showName.trim())} />
          <ReadyItem label="Ticket Prices" ready />
          <ReadyItem label="Band Payout" ready={members.length > 0} />
        </div>

        <p className={`mt-4 font-black uppercase ${venueId && showDate ? "text-emerald-400" : "text-amber-400"}`}>
          {venueId && showDate
            ? "Ready to Create Show"
            : "Select a venue and date to continue"}
        </p>
      </div>

      <button
        type="submit"
        disabled={!venueId || !showDate}
        className="w-full rounded-lg bg-red-600 px-5 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
      >
        Create Show
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  step?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  value,
  onChange,
  min,
  step,
  required = false,
}: FieldProps) {
  const controlledProps =
    value !== undefined
      ? {
          value,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            onChange?.(event.target.value),
        }
      : {
          defaultValue,
        };

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
        {...controlledProps}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
      />
    </div>
  );
}

function VenueStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase text-stone-500">
        {label}
      </p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function ReadyItem({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className={ready ? "text-emerald-400" : "text-stone-500"}>
      <span className="mr-2 font-black">{ready ? "✓" : "○"}</span>
      {label}
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
