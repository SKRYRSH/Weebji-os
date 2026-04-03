// ── WEEBJI OS — Service Worker v21 ────────────────────────────────────────────
const CACHE_NAME = 'weebji-os-v98';
const BASE = self.registration.scope;
const SHELL = [BASE, BASE + 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  // Do NOT skipWaiting here — let the update banner show so user can choose when to reload
});

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (e.data.type === 'LOCAL_NOTIF') {
    const { notifType, title, body } = e.data;
    const cfg = NOTIF_CFG[notifType] || { vibrate: [150, 80, 150], tag: 'weebji-local', requireInteraction: false };
    self.registration.showNotification(title || 'WEEBJI OS', {
      body:               body || 'The System has updated your status.',
      icon:               BASE + 'icons/icon-192.png',
      tag:                cfg.tag,
      renotify:           true,
      vibrate:            cfg.vibrate,
      requireInteraction: cfg.requireInteraction,
      data:               { url: BASE, type: notifType },
    });
  }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHTML = e.request.headers.get('Accept')?.includes('text/html')
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  if (isHTML) {
    // Network-first for HTML — always serve fresh app code when online
    // NOTE: Cannot use new Request(navigate-mode-request, ...) — throws TypeError.
    // Fetch by URL string with cache-busting headers instead.
    e.respondWith(
      fetch(url.href, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match(BASE)))
    );
    return;
  }

  // Cache-first for all other assets
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
  // Server-push types
  streak_reminder:    { vibrate: [200,100,200,100,200], tag: 'weebji-streak',   requireInteraction: false },
  hp_critical:        { vibrate: [400,150,400,150,800], tag: 'weebji-hp',       requireInteraction: true  },
  power_window:       { vibrate: [100,50,100],          tag: 'weebji-power',    requireInteraction: false },
  morning_activation: { vibrate: [100,50,100,50,100],   tag: 'weebji-morning',  requireInteraction: false },
  comeback:           { vibrate: [300,200,300,200,300], tag: 'weebji-comeback', requireInteraction: true  },
  ghost_token:        { vibrate: [200,100,200,100,400], tag: 'weebji-ghost',    requireInteraction: true  },
  level_up:           { vibrate: [50,30,50,30,300],     tag: 'weebji-level',    requireInteraction: false },
  secret_title:       { vibrate: [100,50,200,50,100],   tag: 'weebji-title',    requireInteraction: false },
  weekly_summary:     { vibrate: [200,100,200],         tag: 'weebji-weekly',   requireInteraction: false },
  penance:            { vibrate: [500,200,500],         tag: 'weebji-penance',  requireInteraction: true  },
  streak_7:           { vibrate: [100,50,100,50,300],   tag: 'weebji-streak7',  requireInteraction: false },
  streak_30:          { vibrate: [150,60,150,60,400],   tag: 'weebji-streak30', requireInteraction: false },
  streak_100:         { vibrate: [200,80,200,80,600],   tag: 'weebji-s100',     requireInteraction: true  },
  streak_365:         { vibrate: [300,100,300,100,800], tag: 'weebji-s365',     requireInteraction: true  },
  // Local-notification types (triggered from within the app via LOCAL_NOTIF)
  workout_complete:   { vibrate: [80,40,80,40,200],     tag: 'weebji-workout',  requireInteraction: false },
  sanctuary_complete: { vibrate: [50,30,50,30,150],     tag: 'weebji-void',     requireInteraction: false },
  ritual_complete:    { vibrate: [60,30,120],           tag: 'weebji-ritual',   requireInteraction: false },
  pillar_unlock:      { vibrate: [100,50,200,50,100],   tag: 'weebji-pillar',   requireInteraction: false },
  friend_levelup:     { vibrate: [50,30,50],            tag: 'weebji-friend',   requireInteraction: false },
};

self.addEventListener('push', e => {
  const data  = e.data ? e.data.json() : {};
  const type  = data.type || 'streak_reminder';
  const cfg   = NOTIF_CFG[type] || { vibrate: [200,100,200], tag: 'weebji-default', requireInteraction: false };

  e.waitUntil(
    self.registration.showNotification(data.title || 'WEEBJI OS', {
      body:               data.body || 'The System is watching.',
      icon:               BASE + 'icons/icon-192.png',
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
