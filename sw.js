/* Service Worker — Respect Pharma PWA (v4) */
const CACHE_NAME = 'respect-pharma-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './lobao.jpg'
];

// Requisições que NUNCA devem passar pelo cache
const BYPASS_PATTERNS = [
  /firestore\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebaseapp\.com/,
  /firebasestorage\.googleapis\.com/,
  /google-analytics\.com/,
  /googletagmanager\.com/
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('SW: falha ao cachear', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Permite que o HTML force a troca imediata do SW (usado em "ATUALIZAR SISTEMA")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só lida com GET
  if (req.method !== 'GET') return;

  const url = req.url;

  // Firebase / Auth / Analytics → sempre rede (dados sempre frescos)
  if (BYPASS_PATTERNS.some((re) => re.test(url))) {
    return;
  }

  // Navegação (abrir a página) → network-first com fallback para cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((c) => c.put('./index.html', clone)).catch(() => {})
            );
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((c) => c || caches.match('./')))
    );
    return;
  }

  // Demais requisições → cache-first com fallback rede
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Não cacheia respostas inválidas nem opaque (cross-origin sem CORS)
          if (!res || res.status !== 200 || res.type === 'opaque' || res.type === 'opaqueredirect') {
            return res;
          }
          const resClone = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((c) => c.put(req, resClone)).catch(() => {})
          );
          return res;
        })
        .catch(() => new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});
