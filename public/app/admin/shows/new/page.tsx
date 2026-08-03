import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewShowForm from "@/components/admin/new-show-form";

type NewShowPageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewShowPage({ searchParams }: NewShowPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: venues }, { data: members }] = await Promise.all([
    supabase.from("venues").select("id,name,default_capacity,default_ticket_goal,default_number_of_acts,default_doors_time,default_start_time,default_end_time,radius_clause_weeks,radius_clause_miles,food_discount_percent,meals_included_ticket_threshold").order("name"),
    supabase.from("band_members").select("id,name,default_split_percent").eq("active", true).order("sort_order").order("name"),
  ]);

  const params = await searchParams;

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">Pocket Fuzz</p>
            <h1 className="mt-2 text-4xl font-black uppercase">Add Show</h1>
          </div>
          <Link href="/admin/shows" className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold hover:border-stone-500">Back to Shows</Link>
        </div>
        {params.error ? <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-red-200">{params.error}</div> : null}
        {(venues ?? []).length === 0 ? <div className="mb-6 rounded-lg border border-amber-900 bg-amber-950/40 px-4 py-3 text-amber-200">Add at least one venue under Admin → Venues before creating a show.</div> : null}
        <NewShowForm venues={(venues ?? []) as never[]} members={(members ?? []) as never[]} />
      </div>
    </main>
  );
}
