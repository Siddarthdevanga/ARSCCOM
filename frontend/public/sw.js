/* ============================================================================
   SERVICE WORKER
   Deliberately minimal. A service worker sits between the app and the
   network for every request, so an over-eager one is a very effective way
   to serve people stale data or a half-broken session. The rules here:

     /api/**            never touched. Auth and live data always hit the
                        network; a cached visitor list or a cached login
                        response is worse than no app at all.
     /_next/static/**   cache-first. These filenames contain a content
                        hash, so a given URL can never change meaning.
     navigations        network-first, falling back to the offline page
                        only when the network genuinely fails.
     icons              cache-first, they change about once a year.

   Everything else falls through to the network untouched.
   ========================================================================== */

const VERSION = "hv-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) =>
      c.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"])
    )
  );
  // Take over immediately rather than waiting for every tab to close —
  // otherwise a fix can sit unused for days behind an old worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever handle same-origin GETs. Cross-origin (Razorpay, fonts) and
  // any mutating request go straight to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never intercept the API. This is the single most important rule here.
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build output: safe to serve from cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Page loads: always try the network so nobody sees yesterday's dashboard.
  // The cache is a fallback for genuine failure, not a performance trick.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
