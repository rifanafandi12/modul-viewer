const STATIC_CACHE = 'modul-viewer-static-v2';
const CATALOG_CACHE = 'modul-viewer-catalog-v1';
const RENDERED_CACHE = 'modul-viewer-rendered-v2';
const CATALOG_KEY = new URL('/api/modul', self.location.origin).href;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin/index.html',
  '/css/style.css',
  '/css/tailwind.css',
  '/js/viewer.js',
  '/js/auth.js',
  '/js/admin.js',
  '/img/logo-1.png',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => (name.startsWith('modul-viewer-static-') && name !== STATIC_CACHE)
        || (name.startsWith('modul-viewer-rendered-') && name !== RENDERED_CACHE))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/api/modul' && !url.search) {
    event.respondWith(networkFirstCatalog(request));
    return;
  }

  if (isStaticUiRequest(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});

// Cache katalog publik setelah membatasi field yang disimpan agar token/URL streaming tidak pernah masuk cache.
async function networkFirstCatalog(request) {
  try {
    const response = await fetch(request);
    if (!response.ok) return response;

    const modules = await response.clone().json();
    if (Array.isArray(modules)) {
      const safeModules = modules.map(({ id, title, slug, status, file_size, created_at }) => ({
        id,
        title,
        slug,
        status,
        file_size,
        created_at
      }));
      const cache = await caches.open(CATALOG_CACHE);
      await cache.put(CATALOG_KEY, new Response(JSON.stringify(safeModules), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
    }
    return response;
  } catch {
    const cache = await caches.open(CATALOG_CACHE);
    return await cache.match(CATALOG_KEY) || new Response(
      JSON.stringify({ error: 'Katalog tidak tersedia saat offline.' }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

// Gunakan aset UI yang tersimpan terlebih dahulu, lalu simpan respons jaringan yang berhasil.
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Batasi strategi Cache First pada dokumen UI dan aset statis lokal, tidak termasuk endpoint API.
function isStaticUiRequest(request, url) {
  if (url.pathname === '/' || url.pathname === '/index.html'
    || url.pathname === '/login.html' || url.pathname === '/admin/index.html') {
    return request.mode === 'navigate' || request.destination === 'document';
  }

  return /^\/(css|js|img)\//.test(url.pathname)
    || url.pathname === '/favicon.ico'
    || url.pathname === '/manifest.json';
}
