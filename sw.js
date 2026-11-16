/* Kibir service worker. Bump VERSION on every release so phones pick up the new files. */
const VERSION = "v17";
const CORE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "supabase.min.js"];
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.all(CORE.map(u => c.add(u).catch(() => {})))
  ));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return;               // never touch audio range requests
  const url = new URL(req.url);

  // Page itself: network first, so updates show up right away; cache is the offline fallback
  if (req.mode === "navigate" || (url.origin === location.origin && /(\/$|index\.html$)/.test(url.pathname))) {
    e.respondWith(
      fetch(req).then(r => {
        // only keep good, direct answers for the app page (never errors or redirects)
        const isAppPage = url.origin === location.origin && /(\/$|index\.html$)/.test(url.pathname);
        if (r.ok && !r.redirected && isAppPage) {
          const copy = r.clone();
          caches.open(VERSION).then(c => c.put("index.html", copy));
        }
        return r;
      }).catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Same-origin static files: cache first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok && !r.redirected) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return r;
      }))
    );
  }
  // Everything else (Supabase API, audio, covers) goes straight to the network
});
