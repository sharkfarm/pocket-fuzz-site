import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createShow } from "./actions";

type NewShowPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewShowPage({
  searchParams,
}: NewShowPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">
              Pocket Fuzz
            </p>

            <h1 className="mt-2 text-4xl font-black uppercase">
              Add Show
            </h1>
          </div>

          <Link
            href="/admin/shows"
            className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold hover:border-stone-500"
          >
            Back to Shows
          </Link>
        </div>

        {params.error ? (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-red-200">
            {params.error}
          </div>
        ) : null}

        <form
          action={createShow}
          className="space-y-8 rounded-2xl border border-stone-800 bg-stone-900 p-6 md:p-8"
        >
          <section>
            <h2 className="mb-5 text-lg font-black uppercase">
              Show Information
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Show Name"
                name="show_name"
                placeholder="Pocket Fuzz at Globe Hall"
              />

              <Field
                label="Venue"
                name="venue_name"
                placeholder="Globe Hall"
                required
              />

              <Field
                label="Show Date"
                name="show_date"
                type="date"
                required
              />

              <Field
                label="Capacity"
                name="capacity"
                type="number"
                defaultValue="300"
                min="1"
                required
              />

              <Field
                label="Ticket Goal"
                name="ticket_goal"
                type="number"
                defaultValue="50"
                min="0"
              />

              <Field
                label="Number of Acts"
                name="number_of_acts"
                type="number"
                defaultValue="3"
                min="1"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-5 text-lg font-black uppercase">
              Schedule
            </h2>

            <div className="grid gap-5 md:grid-cols-3">
              <Field
                label="Doors"
                name="doors_time"
                type="time"
                defaultValue="19:00"
              />

              <Field
                label="Show Starts"
                name="start_time"
                type="time"
                defaultValue="20:00"
              />

              <Field
                label="Show Ends"
                name="end_time"
                type="time"
                defaultValue="00:00"
              />
            </div>
          </section>

          <section className="rounded-xl border border-stone-800 bg-stone-950 p-5">
            <h2 className="font-black uppercase">
              Default Ticket Prices
            </h2>

            <div className="mt-4 grid gap-3 text-sm text-stone-300 sm:grid-cols-2">
              <p>Offline presale: $12</p>
              <p>Online: $12</p>
              <p>Door: $15</p>
              <p>Reserved table: $18</p>
            </div>

            <p className="mt-4 text-xs text-stone-500">
              These prices can be edited later for each show.
            </p>
          </section>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 px-5 py-3 font-black uppercase tracking-wide text-white hover:bg-red-500"
          >
            Create Show
          </button>
        </form>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  min?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  min,
  required = false,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        required={required}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none transition focus:border-red-500"
      />
    </div>
  );
}