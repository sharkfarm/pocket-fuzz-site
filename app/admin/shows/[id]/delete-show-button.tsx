"use client";

import { useState } from "react";

export default function DeleteShowButton({
  showName,
}: {
  showName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-900 px-5 py-3 text-sm font-black uppercase tracking-wide text-red-400 hover:bg-red-950/50"
      >
        Delete Show
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-red-900 bg-red-950/30 p-5">
      <p className="font-bold text-red-200">
        Permanently delete “{showName}”?
      </p>

      <p className="mt-2 text-sm text-red-300/80">
        This also deletes its ticket sales, expenses, merchandise
        sales, band payouts, and Venmo orders. This cannot be undone.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-lg bg-red-700 px-5 py-3 text-sm font-black uppercase text-white hover:bg-red-600"
        >
          Yes, Delete Permanently
        </button>

        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-stone-700 px-5 py-3 text-sm font-bold hover:border-stone-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}