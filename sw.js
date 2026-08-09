/* Insert Coin — mode hors ligne.
   CORRECTIF : addAll() est atomique. Un seul fichier manquant (icon-192.png
   absent du dépôt) faisait échouer TOUTE l'installation du service worker,
   donc aucun cache et aucun mode hors ligne. On met chaque fichier en cache
   individuellement : un manquant ne casse plus les autres. */
const CACHE = 'insertcoin-v4.2.4';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './pixel-papa-logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-mask-192.png',
  './icon-mask-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        FILES.map(f => c.add(f).catch(err => console.warn('Non mis en cache :', f)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('generativelanguage')) return;  // jamais de cote en cache
  if (e.request.method !== 'GET') return;

  /* index.html : réseau d'abord, pour que tes mises à jour GitHub arrivent
     sans avoir à vider le cache. Le reste : cache d'abord, plus rapide. */
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
