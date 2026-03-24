// ── WEEBJI OS — Service Worker v8 ─────────────────────────────────────────────
const CACHE_NAME = 'weebji-os-v29';
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
  // ── Existing ──────────────────────────────────────────────────────
  streak_reminder:    { vibrate: [200,100,200,100,200], tag: 'weebji-streak',    requireInteraction: false },
  hp_critical:        { vibrate: [400,150,400,150,800], tag: 'weebji-hp',        requireInteraction: true  },
  power_window:       { vibrate: [100,50,100],          tag: 'weebji-power',     requireInteraction: false },
  morning_activation: { vibrate: [100,50,100,50,100],   tag: 'weebji-morning',   requireInteraction: false },
  comeback:           { vibrate: [300,200,300,200,300], tag: 'weebji-comeback',  requireInteraction: true  },
  ghost_token:        { vibrate: [200,100,200,100,400], tag: 'weebji-ghost',     requireInteraction: true  },
  level_up:           { vibrate: [50,30,50,30,50,30,400], tag: 'weebji-level',   requireInteraction: false },
  secret_title:       { vibrate: [100,50,200,50,100],   tag: 'weebji-title',     requireInteraction: false },
  weekly_summary:     { vibrate: [200,100,200],         tag: 'weebji-weekly',    requireInteraction: false },
  penance:            { vibrate: [500,200,500],         tag: 'weebji-penance',   requireInteraction: true  },
  // ── Streak milestones ─────────────────────────────────────────────
  streak_7:           { vibrate: [100,50,100,50,300],   tag: 'weebji-streak7',   requireInteraction: false },
  streak_30:          { vibrate: [200,100,200,100,500], tag: 'weebji-streak30',  requireInteraction: false },
  streak_100:         { vibrate: [300,100,300,100,800], tag: 'weebji-streak100', requireInteraction: true  },
  streak_365:         { vibrate: [500,100,500,100,1000],tag: 'weebji-streak365', requireInteraction: true  },
  // ── In-app moments ────────────────────────────────────────────────
  workout_complete:   { vibrate: [80,40,80,40,200],     tag: 'weebji-workout',   requireInteraction: false },
  sanctuary_complete: { vibrate: [100,80,100,80,100],   tag: 'weebji-sanctuary', requireInteraction: false },
  ritual_complete:    { vibrate: [60,40,60,40,150],     tag: 'weebji-ritual',    requireInteraction: false },
  pillar_unlock:      { vibrate: [200,100,400],         tag: 'weebji-pillar',    requireInteraction: false },
  xp_surge:           { vibrate: [50,30,50,30,50],      tag: 'weebji-xp',        requireInteraction: false },
};

const BADGE = BASE + 'icons/badge-96.png';

self.addEventListener('push', e => {
  const data  = e.data ? e.data.json() : {};
  const type  = data.type || 'streak_reminder';
  const cfg   = NOTIF_CFG[type] || { vibrate: [200,100,200], tag: 'weebji-default', requireInteraction: false };

  e.waitUntil(
    self.registration.showNotification(data.title || 'WEEBJI OS', {
      body:               data.body || 'The System is watching.',
      icon:               BASE + 'icons/icon-192.png',
      badge:              BADGE,
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

// Local notification (posted directly from the app via postMessage)
self.addEventListener('message', e => {
  if (e.data?.type !== 'LOCAL_NOTIF') return;
  const { notifType, title, body } = e.data;
  const cfg = NOTIF_CFG[notifType] || { vibrate: [200,100,200], tag: 'weebji-local', requireInteraction: false };
  self.registration.showNotification(title || 'WEEBJI OS', {
    body:               body || 'The System is watching.',
    icon:               BASE + 'icons/icon-192.png',
    badge:              BADGE,
    tag:                cfg.tag,
    renotify:           true,
    vibrate:            cfg.vibrate,
    requireInteraction: cfg.requireInteraction,
    data:               { url: BASE, type: notifType },
  });
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
