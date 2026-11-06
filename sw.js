// Financia PWA: solo se almacena la pantalla publica de desconexion.
// Nunca se guardan en Cache Storage respuestas de Firebase, bancos,
// API, saldos, movimientos ni paginas autenticadas.
const OFFLINE_CACHE = 'financia-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== OFFLINE_CACHE)
          .map(key => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      return (await cache.match(OFFLINE_URL)) ||
        new Response('Sin conexion', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    })
  );
});
