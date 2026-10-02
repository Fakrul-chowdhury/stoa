// Stoa service worker: keeps the app working offline.
const VERSION = "stoa-v2.0.5";
const FILES = ["./", "./index.html", "./cal.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the page (so updates arrive), cache first for everything else.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    // Only the app page is kept as the offline copy of index.html; cal.html is served as itself.
    const isApp = /\/(index\.html)?$/.test(new URL(req.url).pathname);
    e.respondWith(
      fetch(req).then(res => {
        if (isApp && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put("./index.html", copy));
        }
        return res;
      }).catch(() => caches.match(isApp ? "./index.html" : req, { ignoreSearch: true }))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
