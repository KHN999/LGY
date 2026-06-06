"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (PWA offline support). Production only — service
 * workers need a secure context (HTTPS), and registering in dev causes stale-
 * asset confusion. No-ops where service workers aren't available.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort */
      });
    }
  }, []);
  return null;
}
