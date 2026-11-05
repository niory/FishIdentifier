// The production build injects a content-derived version and exact asset paths.
const CACHE_PREFIX = `fish-identifier:${self.registration.scope}:`;
const CACHE_NAME = CACHE_PREFIX + (self.__FISH_VERSION__ || 'development');
const PRECACHE = (self.__FISH_PRECACHE__ || []).map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(event.request); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(new URL('index.html', self.registration.scope).href)) || Response.error();
      }
    })());
  } else if (PRECACHE.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(event.request)) || fetch(event.request);
    })());
  }
});
