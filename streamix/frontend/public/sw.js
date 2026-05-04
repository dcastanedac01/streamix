/**
 * Streamix — Service Worker (PWA)
 * Caches app shell for offline use. API responses use network-first.
 * Registered from main.jsx automatically.
 */

const CACHE_NAME   = 'streamix-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// ── Install: pre-cache app shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Cache successful GET API responses for 5 minutes
          if (res.ok && request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS/CSS bundles): cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // App shell (HTML navigation): network-first, fallback to /index.html
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request) || caches.match('/index.html'))
  );
});
