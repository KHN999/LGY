// LGY service worker — conservative offline support.
//
// Strategy: NETWORK-FIRST with a cache fallback. While online the app always
// fetches fresh; if the network takes longer than NETWORK_TIMEOUT_MS and a cached
// copy exists, that copy is shown instead of hanging. Successful GETs are copied into
// the cache so previously-visited screens load offline. Mutations (POST etc.)
// are never cached — offline writes are a later milestone. When offline AND the
// request was never cached, we serve a clean "offline" page instead of erroring.

const CACHE = "lgy-cache-v2";

// How long to wait on the network before falling back to a cached copy.
const NETWORK_TIMEOUT_MS = 8000;
const TIMED_OUT = Symbol("timed-out");

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><style>
body{font-family:-apple-system,system-ui,sans-serif;margin:0;min-height:100vh;
display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:8px;color:#374151;background:#fff;padding:32px;text-align:center}
h1{font-size:20px;margin:0}p{margin:0;color:#6b7280}
button{margin-top:16px;padding:12px 20px;border:0;border-radius:12px;
background:#059669;color:#fff;font-size:16px;font-weight:700}
</style></head><body>
<h1>📴 အင်တာနက် မရှိပါ</h1>
<p>No internet — open this screen once while online, then it works offline.</p>
<button onclick="location.reload()">Retry</button>
</body></html>`;

function offlinePage() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

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
      // The network request, which also refreshes the cache when it succeeds.
      // It is never aborted: if we answer from the cache first it still finishes
      // in the background, so the next visit has the fresh copy.
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
      network.catch(() => {}); // handled below; avoid an unhandled rejection

      try {
        // Don't hang on a weak connection: after NETWORK_TIMEOUT_MS, answer from
        // the cache if this screen/data was loaded before. With nothing cached
        // there is nothing better to show, so keep waiting for the network.
        const first = await Promise.race([
          network,
          new Promise((resolve) => setTimeout(() => resolve(TIMED_OUT), NETWORK_TIMEOUT_MS)),
        ]);
        if (first !== TIMED_OUT) return first;
        const cached = await caches.match(req);
        if (cached) return cached;
        return await network;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const home = await caches.match("/staff");
          if (home) return home;
          return offlinePage(); // clean fallback instead of a scary error
        }
        // Non-navigation (an asset/API) with no cache — let it fail quietly.
        return new Response("", { status: 504, statusText: "offline" });
      }
    })(),
  );
});
