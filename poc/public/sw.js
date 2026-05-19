const CACHE_NAME = 'abax-gantt-v5';
const SHELL_URLS = [
  '/abax-gantt/',
  '/abax-gantt/login',
  '/abax-gantt/gantt',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Estrategia revisada:
//   - Datos de API (GET a /api/...)  → NUNCA cachear. Siempre red. Esto evita que
//     un response stale se sirva al recargar tras una mutación (causa de "tengo que
//     refrescar 2-3 veces para ver mis cambios").
//   - Assets estáticos (JS/CSS/fonts con hash de Vite) → cache-first, ya que el hash
//     en el filename garantiza invalidación al hacer build nuevo.
//   - HTML / shell → network-first con fallback al cache (para offline básico),
//     así siempre se intenta traer el bundle más reciente.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Nunca cachear API
  if (url.pathname.includes('/api/')) {
    return; // dejar pasar al navegador sin tocar
  }

  // Assets hashed por Vite (assets/*-{hash}.js|.css|.woff2) — cache-first
  if (/\/assets\/.+\.(js|css|woff2|woff|ttf|png|svg|jpg)$/.test(url.pathname)
      || /\/fonts\/.+\.(woff2|woff|ttf)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Shell / HTML — network-first con fallback offline
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
