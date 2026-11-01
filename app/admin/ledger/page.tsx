import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bandLedgerRegister, type BandLedgerEntry, type LedgerShow } from "@/lib/band-ledger";
import BandLedger from "@/components/admin/band-ledger";
export const dynamic = "force-dynamic";
type Db = Awaited<ReturnType<typeof createClient>>;

async function allEntries(db: Db) {
  const rows: BandLedgerEntry[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("band_ledger_entries").select("*")
      .order("entry_date").order("sequence").range(offset, offset + 499);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []) as BandLedgerEntry[]);
    if ((data?.length ?? 0) < 500) return { rows, error: null };
  }
}
async function allShows(db: Db) {
  const rows: LedgerShow[] = [];
  for (let offset = 0; ; offset += 500) {
    // This is also the source read by /api/pf-com/shows.
    const { data, error } = await db.from("shows").select("id,show_name,show_date")
      .order("show_date").order("id").range(offset, offset + 499);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) return { rows, error: null };
  }
}
export default async function BandLedgerPage({ searchParams }: {
  searchParams: Promise<{ error?: string; saved?: string; show?: string }>;
}) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/admin/login");
  const query = await searchParams;
  const [entries, shows] = await Promise.all([allEntries(db), allShows(db)]);
  const error = entries.error || shows.error;
  return <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100 sm:px-6">
    <div className="mx-auto max-w-[1600px]">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">Pocket Fuzz · Bookkeeping</p>
      <h1 className="mt-3 text-3xl font-black uppercase sm:text-4xl">Band Ledger</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-400">One running register for the band across all shows. Record actual money paid out and deposited; attach a show when relevant.</p>
      {query.error && <p role="alert" className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-200">{query.error}</p>}
      {query.saved && <p role="status" className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-200">{query.saved === "voided" ? "Transaction voided; original retained in history." : "Transaction posted."}</p>}
      {error ? <section className="mt-6 rounded-xl border border-amber-800 p-5">
        <p className="font-bold text-amber-200">The band ledger could not load. No incomplete balance is displayed.</p>
        <p className="mt-2 text-sm text-stone-400">Apply supabase/06-band-ledger.sql if the band ledger table is missing.</p>
        <p className="mt-2 text-sm text-stone-400">{error}</p>
      </section> : <BandLedger register={bandLedgerRegister(entries.rows, shows.rows)} shows={shows.rows} initialShow={query.show || ""} entryId={crypto.randomUUID()} today={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />}
    </div>
  </main>;
}
