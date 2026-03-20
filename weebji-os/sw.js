// ── WEEBJI OS — Service Worker v7 (icon fix) ─────────────────────────────────
const CACHE_NAME = 'weebji-os-v7';
const BASE = self.registration.scope;
const SHELL = [BASE, BASE + 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(BASE));
    })
  );
});

// Notification type → vibration pattern + behaviour
const NOTIF_CFG = {
  streak_reminder:    { vibrate: [200,100,200,100,200], tag: 'weebji-streak',  requireInteraction: false },
  hp_critical:        { vibrate: [400,150,400,150,800], tag: 'weebji-hp',      requireInteraction: true  },
  power_window:       { vibrate: [100,50,100],          tag: 'weebji-power',   requireInteraction: false },
  morning_activation: { vibrate: [100,50,100,50,100],   tag: 'weebji-morning', requireInteraction: false },
  comeback:           { vibrate: [300,200,300,200,300], tag: 'weebji-comeback',requireInteraction: true  },
  ghost_token:        { vibrate: [200,100,200,100,400], tag: 'weebji-ghost',   requireInteraction: true  },
  level_up:           { vibrate: [50,30,50,30,300],     tag: 'weebji-level',   requireInteraction: false },
  secret_title:       { vibrate: [100,50,200,50,100],   tag: 'weebji-title',   requireInteraction: false },
  weekly_summary:     { vibrate: [200,100,200],         tag: 'weebji-weekly',  requireInteraction: false },
  penance:            { vibrate: [500,200,500],         tag: 'weebji-penance', requireInteraction: true  },
};

self.addEventListener('push', e => {
  const data  = e.data ? e.data.json() : {};
  const type  = data.type || 'streak_reminder';
  const cfg   = NOTIF_CFG[type] || { vibrate: [200,100,200], tag: 'weebji-default', requireInteraction: false };

  e.waitUntil(
    self.registration.showNotification(data.title || 'WEEBJI OS', {
      body:               data.body || 'The System is watching.',
      icon:               BASE + 'icons/icon-192.png',
      badge:              BASE + 'icons/icon-192.png',
      tag:                cfg.tag,
      renotify:           true,
      vibrate:            cfg.vibrate,
      requireInteraction: cfg.requireInteraction,
      data:               { url: data.url || BASE, type },
      actions:            cfg.requireInteraction
        ? [{ action: 'open', title: 'Open App' }]
        : undefined,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || BASE;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(target);
    })
  );
});
