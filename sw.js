// Service worker : rend le site installable et lui permet de démarrer hors ligne.
const CACHE = 'talco-v2';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'favicon.ico',
  'icons/favicon-48.png',
  'icons/favicon-dark-48.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // On ne touche ni aux autres sites, ni aux requêtes non GET
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Pages : le réseau d'abord, la copie en cache si on est hors ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  // Autres fichiers : le cache d'abord, mis à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
