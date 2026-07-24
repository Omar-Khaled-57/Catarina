"use client";

/**
 * ServiceWorkerRegister — Registers the service worker for PWA support.
 * Runs once on app load to enable offline capabilities and caching.
 */

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);

  return null;
}
