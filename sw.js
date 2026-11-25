// Поменяй номер после каждой правки файлов (на всякий случай: страница и так берётся из сети первой).
var CACHE = 'brain-v15';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })); self.clients.claim(); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // данные идут напрямую на сервер
  var page = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname) || /\.(js|webmanifest)$/.test(u.pathname);
  if (page) { // сеть первой → всегда свежая версия; без интернета — из кеша
    e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(e.request, c); }); return r; })
      .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
