"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function MetaCheckoutButton() {
  function trackCheckout() {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout");
    }
  }

  return (
    <button
      type="submit"
      onClick={trackCheckout}
      className="w-full rounded-lg bg-red-600 px-6 py-4 font-black uppercase tracking-wide hover:bg-red-500"
    >
      Continue to Venmo
    </button>
  );
}
