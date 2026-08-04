import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
          Pocket Fuzz Admin
        </p>

        <h1 className="mt-3 text-4xl font-black uppercase">
          Inventory
        </h1>

        <div className="mt-8 rounded-2xl border border-stone-800 bg-stone-900 p-8">
          <p className="text-lg text-stone-300">
            Track merchandise quantities and shirt sizes. Inventory automation can be added here next.
          </p>

          <p className="mt-4 text-sm text-stone-500">
            This page is connected to the shared admin navigation and is ready
            for the next feature build.
          </p>

          <Link
            href="/admin"
            className="mt-7 inline-flex rounded-lg border border-stone-700 px-5 py-3 font-black uppercase hover:border-red-700 hover:text-red-300"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
