const CACHE_NAME = 'fish-identifier-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/js/vendors~main.chunk.js',
  '/static/css/main.chunk.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/model/model.json',
  '/model/metadata.json'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэширую файлы для оффлайн работы');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Ошибка кэширования:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляю старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Перехват запросов и отдача из кэша
self.addEventListener('fetch', event => {
  // Исключаем запросы к модели (они большие)
  if (event.request.url.includes('/model/') && !event.request.url.endsWith('.json')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если файл есть в кэше, возвращаем его
        if (response) {
          return response;
        }
        
        // Иначе делаем сетевой запрос
        return fetch(event.request).then(response => {
          // Не кэшируем если ответ не успешный
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Клонируем ответ для кэширования
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});