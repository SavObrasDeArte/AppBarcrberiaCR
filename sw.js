const CACHE_NAME = 'mi-cache';
const urlsToCache = [
    '/',
    '/index.html',
    '/src/main.jsx',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache abierto');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        (async function () {
            try {
                if (event.request.url.startsWith('http')) {
                    const cachedResponse = await caches.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    const fetchRequest = event.request.clone();
                    const response = await fetch(fetchRequest);

                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const responseToCache = response.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, responseToCache);

                    return response;
                } else {
                    return fetch(event.request);
                }
            } catch (error) {
                console.error('Error en el Service Worker fetch:', error);
                throw error;
            }
        })()
    );
});



self.addEventListener('activate', event => {
    const cacheWhitelist = ['mi-cache'];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
