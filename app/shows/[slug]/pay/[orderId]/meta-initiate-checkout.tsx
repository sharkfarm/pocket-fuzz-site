"use client";

import { useEffect } from "react";

export default function MetaInitiateCheckout() {
  useEffect(() => {
    let attempts = 0;

    const sendEvent = () => {
      attempts += 1;

      if (typeof window.fbq === "function") {
        window.fbq("track", "InitiateCheckout");
        console.log("[Meta] InitiateCheckout sent");
        return;
      }

      console.log(`[Meta] fbq not ready - attempt ${attempts}`);

      if (attempts < 40) {
        window.setTimeout(sendEvent, 250);
      } else {
        console.error("[Meta] InitiateCheckout failed: fbq never became available");
      }
    };

    sendEvent();
  }, []);

  return null;
}
