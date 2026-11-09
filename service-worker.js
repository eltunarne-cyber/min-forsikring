// Service worker: cacher alle app-filer slik at appen virker uten nett.
// Cache-first for app-filer. Bytt CACHE-versjonen når appen endres, ellers
// får brukerne ikke de nye filene.

const CACHE = 'min-forsikring-v1.0.2';

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/model.js',
  './js/ui.js',
  './js/ics.js',
  './js/backup.js',
  './js/documents.js',
  './js/images.js',
  './js/prompt.js',
  './js/assistant-provider.js',
  './js/views/home.js',
  './js/views/reminders.js',
  './js/views/assistant.js',
  './js/views/edit.js',
  './js/views/inventory.js',
  './js/views/settings.js',
  './js/vendor/pdfjs/pdf.min.js',
  './js/vendor/pdfjs/pdf.worker.min.js',
  './fonts/nunito-500.woff2',
  './fonts/nunito-700.woff2',
  './fonts/nunito-800.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

// På localhost brukes nettet først, slik at nye filer vises med en gang under testing.
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Slett gamle versjoner av cachen.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('min-forsikring-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // eksterne lenker går rett til nettet

  // Sideåpninger: vis alltid appen (index.html) fra cachen.
  if (req.mode === 'navigate' && !DEV) {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req)),
    );
    return;
  }

  // Under testing på egen PC (localhost): hent nyeste fil først, cache som reserve.
  if (DEV) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })),
    );
    return;
  }

  // Cache-first: bruk lagret fil, hent fra nettet bare hvis den mangler.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    }),
  );
});
