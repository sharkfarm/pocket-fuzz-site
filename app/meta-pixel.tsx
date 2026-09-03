"use client";

import { useEffect } from "react";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __pocketFuzzMetaPixelInitialized?: boolean;
  }
}

const PIXEL_ID = "1615201226612136";

export default function MetaPixel() {
  useEffect(() => {
    if (window.__pocketFuzzMetaPixelInitialized) {
      return;
    }

    window.__pocketFuzzMetaPixelInitialized = true;

    let fbq = window.fbq;

    if (!fbq) {
      fbq = function (...args: unknown[]) {
        if (fbq?.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq?.queue.push(args);
        }
      } as Fbq;

      fbq.queue = [];
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";

      window.fbq = fbq;
      window._fbq = fbq;
    }

    fbq("init", PIXEL_ID);
    fbq("track", "PageView");

    if (!document.getElementById("meta-pixel-script")) {
      const script = document.createElement("script");
      script.id = "meta-pixel-script";
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    console.log(`[Meta] Pixel ${PIXEL_ID} initialized`);
  }, []);

  return null;
}
