"use client";

import { useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function MetaCheckoutButton() {
  const [submitting, setSubmitting] = useState(false);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout");
    }

    const form = event.currentTarget.form;

    setTimeout(() => {
      form?.requestSubmit();
    }, 400);
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      disabled={submitting}
      className="w-full rounded-lg bg-red-600 px-6 py-4 font-black uppercase tracking-wide hover:bg-red-500 disabled:opacity-60"
    >
      {submitting ? "Opening Venmo..." : "Continue to Venmo"}
    </button>
  );
}