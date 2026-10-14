// Офлайн-кэш: сначала сеть (чтобы обновления доходили), без сети — из кэша
// v4: в кэш попадают только удачные ответы; запросы к таблице рекордов (Supabase) идут мимо кэша
const CACHE = 'blocks-v4';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url), own = url.origin === self.location.origin;
  // чужие адреса, кроме шрифтов Google, не трогаем: таблица рекордов без сети должна честно писать «Нет связи»
  if (!own && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  // свои файлы всегда сверяем с сервером (no-cache), чтобы обновления доходили сразу,
  // а не через 10 минут кэша GitHub Pages
  const req = own ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : e.request;
  e.respondWith(
    fetch(req)
      .then(res => {
        // ошибки (404, 500) в кэш не кладём, иначе без сети откроется страница ошибки
        if (res.ok || (!own && res.type === 'opaque')) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
