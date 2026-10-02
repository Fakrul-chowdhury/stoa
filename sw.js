// Stoa service worker: keeps the app working offline and shows reminder notifications.
const VERSION = "stoa-v2.0.11";
const NOTIFY = "stoa-notify"; // goal names for reminders, written by the app; kept across updates
const FILES = ["./", "./index.html", "./cal.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== NOTIFY).map(k => caches.delete(k))))
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

// A reminder is due. The push only carries the ids of the goals; their names are read from this phone.
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let msg = {}, names = {};
    try { msg = e.data ? e.data.json() : {}; } catch (err) {}
    try {
      const hit = await (await caches.open(NOTIFY)).match("./reminders.json");
      if (hit) names = await hit.json();
    } catch (err) {}
    const due = (msg.ids || []).map(id => names[id]).filter(Boolean);
    const title = msg.test ? "Stoa" : due.length > 1 ? "Goals due now" : "Goal due now";
    const body = msg.test ? "Notifications are working." : due.length ? due.join("\n") : "You have a goal due.";
    // A push must always end in a notification, or the phone stops delivering them.
    await self.registration.showNotification(title, { body, tag: msg.test ? "stoa-test" : "stoa-" + (msg.t || "due"), icon: "./icon-192.png" });
  })());
});

// Tapping the notification brings Stoa to the front.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => "focus" in c);
    return open ? open.focus() : clients.openWindow("./");
  }));
});
