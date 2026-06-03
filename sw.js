const CACHE = 'mini-weather-v3';
const urls = ['/', '/index.html', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls).catch(() => {})));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => {
            if (r) return r;
            return fetch(e.request).catch(() => new Response('Offline'));
        })
    );
});

self.addEventListener('sync', e => {
    if (e.tag === 'sync-weather') {
        e.waitUntil(fetch('/api/weather').catch(() => {}));
    }
});

self.addEventListener('message', e => {
    if (e.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(e.data.title, e.data.options);
    }
});
