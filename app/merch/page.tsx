import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MerchShop, {
  type MerchProduct,
} from "@/components/merch/merch-shop";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function MerchPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("merch_products")
    .select("id,name,description,price")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-stone-100">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-stone-400 hover:text-white"
          >
            ← Pocket Fuzz Home
          </Link>

          <Link
            href="/shows"
            className="text-sm font-bold text-stone-400 hover:text-white"
          >
            Shows
          </Link>
        </div>

        <p className="mt-10 text-xs font-black uppercase tracking-[0.3em] text-red-500">
          Pocket Fuzz
        </p>

        <h1 className="mt-3 text-5xl font-black uppercase">
          Merch
        </h1>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-400">
          Pick your items, choose shirt sizes and quantities, then check out
          once with Venmo.
        </p>

        {query.error ? (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/50 p-5 text-red-200">
            <p className="font-black uppercase">Checkout Error</p>
            <p className="mt-2 text-sm leading-6">{query.error}</p>
          </div>
        ) : null}

        <MerchShop products={(data ?? []) as MerchProduct[]} />
      </div>
    </main>
  );
}
