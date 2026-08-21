"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. Production-only and deliberately quiet
 * about failures — a service worker is a progressive enhancement here
 * (faster repeat loads, an offline fallback page), never something the
 * app's actual functionality depends on, so a browser without support or
 * a registration error should never surface as a user-visible problem.
 *
 * Skipped in development: a cached service worker fighting with Turbopack's
 * fast refresh/HMR is a well-known source of "why isn't my change showing
 * up" confusion, and there's nothing here worth caching before a real
 * build exists anyway.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No-op — see the component doc comment above.
    });
  }, []);

  return null;
}
