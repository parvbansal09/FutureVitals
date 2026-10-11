// FutureVitals offline worker. Generated into dist/sw.js at build time with
// the list of files the build produced. It stores the app itself so every
// screen opens without a connection. It never stores or sends answers: those
// live in on-device storage the worker cannot see, and the only requests it
// lets through to the network are ones the page itself makes.
const VERSION = '__VERSION__';
const APP_CACHE = 'fv-app-' + VERSION;
const RUNTIME_CACHE = 'fv-runtime-v1';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fv-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Off-origin requests (the product lookup) are never cached here; the
  // scanner keeps its own on-device cache of products it has looked up.
  if (url.origin !== self.location.origin) return;

  // The OCR engine and the built-in product list: cache on first use, so a
  // second ingredient photo, or a product looked up before, works offline.
  if (url.pathname.includes('/ocr/') || /\/assets\/(p-\d\d|names)-[\w-]+\.js$/.test(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })),
      ),
    );
    return;
  }

  // Everything else: the stored copy first, the network as a fallback.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('./index.html'))),
  );
});
