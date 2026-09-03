"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export default function MetaInitiateCheckout() {
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout");
    }
  }, []);

  return null;
}
