const CACHE_NAME = 'jam-physics-v2';
const BASE_PATH = '/JAM-PH-PROGRESS-TRACKER';

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json'
];

// ================================
// INSTALL
// ================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(error => {
        console.error('Service Worker install error:', error);
      })
  );

  // Activate new SW immediately
  self.skipWaiting();
});


// ================================
// ACTIVATE
// ================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => {
      // Take control of all open pages immediately
      return self.clients.claim();
    })
  );
});


// ================================
// FETCH
// ================================
self.addEventListener('fetch', event => {

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * HTML + Manifest:
   * NETWORK FIRST
   *
   * This is the important part.
   * Browser will try GitHub first, so updates
   * are not permanently stuck in the old cache.
   */
  const isHTML =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.endsWith('.html');

  const isManifest =
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('manifest.json');

  if (isHTML || isManifest) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {

          if (
            !networkResponse ||
            networkResponse.status !== 200
          ) {
            throw new Error('Network response invalid');
          }

          // Save latest version to cache
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(request);
        })
    );

    return;
  }


  /*
   * Other files:
   * CACHE FIRST
   *
   * Good for CSS, JS, fonts, etc.
   */
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(networkResponse => {

            if (
              !networkResponse ||
              networkResponse.status !== 200
            ) {
              return networkResponse;
            }

            const responseClone = networkResponse.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });

            return networkResponse;
          })
          .catch(() => {
            return caches.match(request);
          });
      })
  );
});


// ================================
// MESSAGE HANDLER
// ================================
self.addEventListener('message', event => {

  if (!event.data) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});