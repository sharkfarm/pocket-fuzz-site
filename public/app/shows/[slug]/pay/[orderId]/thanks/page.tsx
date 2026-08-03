import Link from "next/link";

export default function ThanksPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-stone-100">
      <div className="max-w-xl rounded-2xl border border-stone-800 bg-stone-900 p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
          Pocket Fuzz
        </p>
        <h1 className="mt-4 text-4xl font-black uppercase">
          Payment Submitted
        </h1>
        <p className="mt-4 text-stone-400">
          Your selections are saved. We will verify the payment in Venmo and
          approve the order in the Pocket Fuzz dashboard.
        </p>
        <Link
          href="/shows"
          className="mt-7 inline-block rounded-lg border border-stone-700 px-5 py-3 font-bold"
        >
          Back to Shows
        </Link>
      </div>
    </main>
  );
}
