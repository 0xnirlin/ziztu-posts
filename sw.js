/* Service worker: app shell offline, encrypted assets cached once (their names never change). */
const V = "fefe44cc74";
const SHELL = "zc-shell-" + V;
const ASSETS = "zc-assets-v1";
const DATA = "zc-data-v1";
const SHELL_FILES = ["./", "index.html", "styles.css?v=" + V, "app.js?v=" + V, "manifest.webmanifest", "icons/seal.svg", "icons/icon-180.png", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("zc-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  const path = url.pathname;
  const base = self.registration.scope.replace(location.origin, "");
  const rel = path.startsWith(base) ? path.slice(base.length) : path;

  // the two small encrypted index files: network first, cache for offline
  if (rel === "a/d" || rel === "a/p") {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try {
        const res = await fetch(e.request, { cache: "no-store" });
        if (res.ok) c.put(rel, res.clone());
        return res;
      } catch {
        const hit = await c.match(rel);
        return hit || Response.error();
      }
    })());
    return;
  }
  // encrypted media: names are content hashes, so cache forever
  if (rel.startsWith("a/")) {
    e.respondWith((async () => {
      const c = await caches.open(ASSETS);
      const hit = await c.match(rel);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(rel, res.clone()).catch(() => {});
      return res;
    })());
    return;
  }
  // pages: network first so a new build shows up at once; offline falls back to the cached shell
  if (e.request.mode === "navigate" || rel === "" || rel === "index.html") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const res = await fetch(e.request.url, { cache: "no-store", credentials: "same-origin" }); // a navigate Request can't take an init
        if (res.ok) c.put("index.html", res.clone());
        return res;
      } catch {
        return (await c.match("index.html")) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }
  // versioned app files: cache first, then network
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = await c.match(e.request, { ignoreSearch: e.request.mode === "navigate" });
    if (hit) return hit;
    try {
      return await fetch(e.request);
    } catch {
      return (await c.match("index.html")) || Response.error();
    }
  })());
});
