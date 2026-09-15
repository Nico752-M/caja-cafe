/* Sube este número cada vez que despliegues cambios nuevos en Vercel,
   si no, los usuarios seguirán viendo la versión vieja guardada en caché. */
const CACHE = 'cafe-real-v4';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Las llamadas a Oracle NUNCA se cachean: siempre deben ir a la red
  // (si fallan, la propia app las encola en IndexedDB, no el service worker).
  if (url.includes('oraclecloudapps.com')) return;

  // Fuentes de Google: si hay red, se traen y se guardan; si no hay red y no
  // están en caché, simplemente no cargan (la app sigue funcionando sin ellas).
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request)
          .then((resp) => {
            caches.open(CACHE).then((c) => c.put(e.request, resp.clone()));
            return resp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

   // El resto (HTML, JS, CSS propios): red primero, caché de respaldo si no hay internet.
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() => {
        return caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match('/');
          return new Response('', { status: 504, statusText: 'Sin conexión' });
        });
      })
  );
});
