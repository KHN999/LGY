// LGY service worker — conservative offline support.
//
// Strategy: NETWORK-FIRST with a cache fallback. While online the app always
// fetches fresh from the network (no staleness on the live shop); responses are
// copied into the cache so that when the phone is offline (e.g. joined to the
// printer's WiFi) previously-used screens and data still load. Mutations (POST
// etc.) are never cached — offline writes are a later milestone.

const CACHE = "lgy-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch mutations

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // same-origin only
  if (url.pathname.startsWith("/api/auth")) return; // don't cache auth/session

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const home = await caches.match("/staff");
          if (home) return home;
        }
        throw new Error("offline and not cached");
      }
    })(),
  );
});
