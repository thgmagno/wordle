// Wordle Multiplayer service worker.
//
// Scope is intentionally narrow. This app's entire value is showing LIVE
// multiplayer state — who's in the room, whose turn it is, the current
// round, the score — and CLAUDE.md's server-authoritative principle
// means the client is never a trusted source of truth for any of that.
// A service worker that cached a dynamic page and replayed it later
// could show a stale player list, a finished round as still active, or
// worse. So this only ever caches content that's either static and
// content-hashed by the Next.js build (safe to cache forever, since a
// given URL's bytes never change) or a small, explicit app-shell list —
// every page navigation and every API/Server Action call always goes
// straight to the network, exactly as if this file didn't exist.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `wordle-static-${CACHE_VERSION}`;
const APP_SHELL_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => {
        // Best-effort — a failed precache (e.g. offline during install)
        // shouldn't block the service worker from installing at all.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("wordle-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle simple GETs — Server Actions and every other
  // mutating call are always POST, and must never be intercepted or
  // (accidentally, by some future edit to this file) replayed from cache.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Same-origin only — leaves Pusher's realtime traffic and anything else
  // cross-origin completely untouched.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Next.js's own build output: filenames are content-hashed, so a given
  // URL's response never changes — safe to serve cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Icons and other public static assets: same reasoning.
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else that's a real page navigation (not a data/RSC fetch,
  // not an API call) goes straight to the network — this is the one place
  // this service worker steps in at all, and only to show a friendly
  // offline page instead of the browser's own error screen when there's
  // truly no connectivity. A request that fails for any other reason
  // (a real server error, a 404) fails exactly as it would with no
  // service worker installed.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((cached) => cached || Response.error()),
      ),
    );
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
