/* Service Worker — Respect Pharma PWA */
const CACHE_NAME = 'respect-pharma-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './lobao.jpg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('SW: falha ao cachear', url, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só lida com GET
  if (req.method !== 'GET') return;

  // Ignora requisições do Firebase (sempre rede)
  const url = req.url;
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com/firebase')) {
    return;
  }

  // Estratégia: cache-first com fallback para rede
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // Cacheia apenas respostas válidas do mesmo domínio ou fontes
        if (!res || res.status !== 200 || res.type === 'opaque') {
          return res;
        }
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try { cache.put(req, resClone); } catch (e) {}
        });
        return res;
      }).catch(() => {
        // Offline: se for navegação, devolve index
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
