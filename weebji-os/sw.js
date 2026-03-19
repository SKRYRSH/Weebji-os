// ── WEEBJI OS — Service Worker v2 ──────────────────────────────────────────
// Single-file PWA. Only caches what actually exists.

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'weebji-os-v2';
const SHELL = ['/index.html', '/manifest.json'];

// Install — cache the shell
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

// Activate — purge old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for shell, passthrough for Google Fonts / CDN
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Only cache same-origin responses
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Push received — show notification
self.addEventListener('push', e => {
  const data  = e.data ? e.data.json() : {};
  const title = data.title || 'WEEBJI OS';
  const body  = data.body  || 'The System is watching. Open now.';
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:      '/icons/icon-192.png',
      badge:     '/icons/icon-192.png',
      tag:       'weebji-daily',
      renotify:  true,
      vibrate:   [200, 100, 200],
      data:      { url: data.url || '/' }
    })
  );
});

// Notification clicked — open / focus the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
