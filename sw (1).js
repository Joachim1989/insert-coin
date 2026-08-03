const CACHE = 'pixel-papa-brocante-v1';
const ASSETS = [
  './',
  './pixel-papa-brocante.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-mask-192.png',
  './icon-mask-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('generativelanguage') || event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => {
    if (resp && resp.ok && url.origin === location.origin) {
      const copy = resp.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return resp;
  }).catch(() => caches.match('./pixel-papa-brocante.html'))));
});
