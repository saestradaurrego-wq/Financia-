/* Financia PWA: no cachear información financiera, autenticación ni respuestas de API. */
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  // Todas las solicitudes van a la red. Evita datos privados obsoletos en caché.
  return;
});
