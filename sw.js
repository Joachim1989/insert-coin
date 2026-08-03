/* Insert Coin — mode hors ligne.
   Le barème local doit rester consultable sans réseau (les brocantes saturent la 4G).
   Les appels à l'API Gemini ne sont jamais mis en cache. */
const CACHE = "insertcoin-v1";
const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-mask-192.png",
  "./icon-mask-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Jamais de cache sur l'API : une cote périmée est pire que pas de cote.
  if (url.hostname.includes("generativelanguage")) return;
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
