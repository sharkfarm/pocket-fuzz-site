import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addBandMember, deleteBandMember, updateBandMember } from "../shows/[id]/actions";

type PageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function BandMembersPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: members, error } = await supabase
    .from("band_members")
    .select("id,name,role,active,sort_order")
    .order("sort_order")
    .order("name");

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/shows" className="text-sm font-bold text-stone-400 hover:text-white">
          ← Back to Shows
        </Link>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-red-500">Pocket Fuzz Admin</p>
        <h1 className="mt-3 text-4xl font-black uppercase">Band Members</h1>

        {query.saved ? <div className="mt-6 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-200">Band member {query.saved}.</div> : null}
        {query.error || error ? <div className="mt-6 rounded-lg border border-red-900 bg-red-950/50 p-4 text-red-200">{query.error ?? error?.message}</div> : null}

        <section className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-6">
          <h2 className="text-xl font-black uppercase">Add Band Member</h2>
          <form action={addBandMember} className="mt-5 grid gap-4 md:grid-cols-4">
            <Field label="Name" name="name" placeholder="Bobby" required />
            <Field label="Role" name="role" placeholder="Drums" />
            <Field label="Sort Order" name="sort_order" type="number" min="0" step="1" defaultValue="0" />
            <div className="flex items-end">
              <button className="w-full rounded-lg bg-red-600 px-5 py-3 font-black uppercase hover:bg-red-500">Add Member</button>
            </div>
          </form>
        </section>

        <section className="mt-8 space-y-4">
          {(members ?? []).map((member) => (
            <details key={member.id} className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div>
                  <p className="text-xl font-black">{member.name}</p>
                  <p className="mt-1 text-sm text-stone-400">
                    {member.role || "No role"} · {member.active ? "Active" : "Inactive"}
                  </p>
                </div>
                <span className="text-sm font-bold text-stone-400">Edit</span>
              </summary>

              <form action={updateBandMember} className="mt-5 grid gap-4 border-t border-stone-800 pt-5 md:grid-cols-4">
                <input type="hidden" name="member_id" value={member.id} />
                <Field label="Name" name="name" defaultValue={member.name} required />
                <Field label="Role" name="role" defaultValue={member.role ?? ""} />
                <Field label="Sort Order" name="sort_order" type="number" min="0" step="1" defaultValue={String(member.sort_order)} />
                <label className="flex items-center gap-3 rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 md:self-end">
                  <input type="checkbox" name="active" defaultChecked={member.active} /> Active
                </label>
                <div className="md:col-span-4 flex justify-end">
                  <button className="rounded-lg bg-red-600 px-5 py-2 font-black uppercase hover:bg-red-500">Save</button>
                </div>
              </form>

              <form action={deleteBandMember} className="mt-4 flex justify-end border-t border-stone-800 pt-4">
                <input type="hidden" name="member_id" value={member.id} />
                <button className="text-sm font-bold text-red-400">Delete Member</button>
              </form>
            </details>
          ))}
        </section>
      </div>
    </main>
  );
}

function Field(props: {
  label: string; name: string; type?: string; placeholder?: string;
  defaultValue?: string; min?: string; step?: string; required?: boolean;
}) {
  const { label, name, type="text", placeholder, defaultValue, min, step, required=false } = props;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        step={step}
        required={required}
        className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-red-500"
      />
    </label>
  );
}
