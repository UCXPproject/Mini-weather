// Service Worker - Mini Weather
// Offline support, smart caching, push notifications
'use strict';

const CACHE_NAME    = 'mini-weather-v3';
const CACHE_STATIC  = 'mini-weather-static-v3';
const CACHE_API     = 'mini-weather-api-v3';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json'
];

// API domains to cache with network-first strategy
const API_DOMAINS = [
    'api.weatherapi.com',
    'api.open-meteo.com',
    'api.weather.gov',
    'wttr.in',
    'nominatim.openstreetmap.org'
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_STATIC).then(cache => {
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('SW: Failed to cache some static assets:', err);
            });
        })
    );
    self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_STATIC && name !== CACHE_API)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // API requests: network-first, cache fallback (max 10 min stale)
    const isApiRequest = API_DOMAINS.some(domain => url.hostname.includes(domain));
    if (isApiRequest) {
        event.respondWith(networkFirstWithCache(event.request, CACHE_API, 10 * 60 * 1000));
        return;
    }

    // Static assets: cache-first, network fallback
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});

// ── Network-first with cache fallback ────────────────────────────────────────
async function networkFirstWithCache(request, cacheName, maxAge) {
    try {
        const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
            const cache = await caches.open(cacheName);
            // Store with timestamp header
            const headers = new Headers(response.headers);
            headers.set('sw-cached-at', Date.now().toString());
            const cachedResponse = new Response(await response.clone().blob(), {
                status:     response.status,
                statusText: response.statusText,
                headers
            });
            cache.put(request, cachedResponse);
        }
        return response;
    } catch (err) {
        // Network failed — try cache
        const cache    = await caches.open(cacheName);
        const cached   = await cache.match(request);
        if (cached) {
            const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0');
            if (Date.now() - cachedAt < maxAge) {
                return cached;
            }
        }
        throw err;
    }
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    if (!event.data) return;

    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options = {} } = event.data;
        const notifOptions = {
            body:    options.body    || '',
            icon:    options.icon    || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%231e88e5' width='64' height='64' rx='12'/><text x='50%' y='54%' font-size='40' dominant-baseline='middle' text-anchor='middle'>🌤️</text></svg>",
            badge:   options.badge   || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%231e88e5' width='64' height='64' rx='12'/><text x='50%' y='54%' font-size='40' dominant-baseline='middle' text-anchor='middle'>🌤️</text></svg>",
            tag:     options.tag     || 'mini-weather',
            vibrate: options.vibrate || [200, 100, 200],
            requireInteraction: options.requireInteraction || false,
            data:    { url: '/' },
            actions: [
                { action: 'open',    title: 'Open App' },
                { action: 'dismiss', title: 'Dismiss'  }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(title, notifOptions)
        );
    }

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// ── Push event (for future server-sent pushes) ────────────────────────────────
self.addEventListener('push', event => {
    if (!event.data) return;
    try {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title || 'Mini Weather', {
                body:    data.body    || 'Weather update available',
                icon:    data.icon    || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect fill='%231e88e5' width='64' height='64' rx='12'/><text x='50%' y='54%' font-size='40' dominant-baseline='middle' text-anchor='middle'>🌤️</text></svg>",
                tag:     data.tag     || 'mini-weather-push',
                vibrate: [200, 100, 200],
                data:    { url: '/' }
            })
        );
    } catch (err) {
        console.warn('SW: Push event parse error:', err);
    }
});
