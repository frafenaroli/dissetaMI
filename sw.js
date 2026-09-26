/* DissetaMI service worker, scritto a mano e senza dipendenze.
 * - navigazioni e data/punti.json: prima la rete, poi la cache (dati sempre freschi se c'è connessione);
 * - file statici del sito (Leaflet incluso) e Google Fonts: stale-while-revalidate;
 * - tile della mappa e ricerca indirizzi: solo rete.
 * Cambiare VERSION quando si modificano i file del sito.
 */
const VERSION = 'v3';
const SHELL = `dissetami-shell-${VERSION}`;
const DATI = `dissetami-dati-${VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/i18n.js',
  './js/app.js',
  './icons/claudecode.png',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/lucide/sprite.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const tieni = new Set([SHELL, DATI]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !tieni.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function primaRete(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const fresca = await fetch(request);
    if (fresca && fresca.ok) cache.put(request, fresca.clone());
    return fresca;
  } catch (err) {
    const salvata = (await cache.match(request, { ignoreSearch: true })) || (fallback && (await caches.match(fallback)));
    if (salvata) return salvata;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const salvata = await cache.match(request);
  const rete = fetch(request)
    .then((r) => { if (r && r.ok) cache.put(request, r.clone()); return r; })
    .catch(() => salvata);
  return salvata || rete;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(primaRete(request, SHELL, './index.html'));
  } else if (url.origin === self.location.origin && url.pathname.endsWith('/data/punti.json')) {
    event.respondWith(primaRete(request, DATI));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
