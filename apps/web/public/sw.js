// LGY service worker — conservative offline support.
//
// Strategy: NETWORK-FIRST with a cache fallback. While online the app always
// fetches fresh (no staleness on the live shop); successful GETs are copied into
// the cache so previously-visited screens load offline. Mutations (POST etc.)
// are never cached — offline writes are a later milestone. When offline AND the
// request was never cached, we serve a clean "offline" page instead of erroring.

const CACHE = "lgy-cache-v2";

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
          return offlinePage(); // clean fallback instead of a scary error
        }
        // Non-navigation (an asset/API) with no cache — let it fail quietly.
        return new Response("", { status: 504, statusText: "offline" });
      }
    })(),
  );
});
