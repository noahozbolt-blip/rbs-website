const CACHE = 'rbs-portal-shell-v1';
const STATIC = ['/portal/', '/portal/portal.css', '/portal/app.js', '/assets/icons/rbs-icon-192.png', '/assets/icons/rbs-icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rbs-portal-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Never cache identity traffic, APIs, account data, drafts or incoming requests.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !STATIC.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(url.pathname)) || Response.error()));
});
