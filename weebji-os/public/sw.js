// ── WEEBJI OS — Service Worker v381 ────────────────────────────────────────────
const CACHE_NAME = 'weebji-os-v381';
// Images/fonts survive version bumps — deploys only re-fetch the HTML shell.
// Bump ASSET_CACHE ONLY when an existing asset file is replaced in place
// (same filename, new content). New filenames need no bump — cache-on-miss.
const ASSET_CACHE = 'weebji-assets-v1';
const BASE = self.registration.scope;
const SHELL = [BASE, BASE + 'manifest.json', BASE + 'icons/icon-192.png', BASE + 'icons/badge-96.png'];
const _isPersistentAsset = (url) =>
  (url.origin === self.location.origin && url.pathname.includes('/assets/'))
  || url.hostname === 'fonts.gstatic.com'
  || url.hostname === 'fonts.googleapis.com';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)));
  // Do NOT skipWaiting here — we want the update banner to show
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
      badge:              BASE + 'icons/badge-96.png',
      tag:                cfg.tag,
      renotify:           true,
      vibrate:            cfg.vibrate,
      requireInteraction: cfg.requireInteraction,
      data:               { url: BASE, type: notifType },
    });
  }
});

const BG_IMAGES = [
  'assets/bg-monarch.jpeg','assets/bg-mastermind.jpeg','assets/bg-monk.jpeg',
  'assets/bg-city.jpeg','assets/bg-dungeon.jpeg','assets/bg-class-select.jpeg',
  'assets/bg-oath.jpeg','assets/bg-levelup.jpeg',
  // Ch2/Ch3 stills — every new user plays these on day 2/3; must be instant +
  // offline-safe. Pre-warm skips missing files (status 200 check), so listing
  // Ch3 before its stills land is safe.
  'assets/cutscenes/ch2-1.jpg','assets/cutscenes/ch2-2.jpg',
  'assets/cutscenes/ch2-3.jpg','assets/cutscenes/ch2-4.jpg',
  'assets/cutscenes/ch3-1.jpg','assets/cutscenes/ch3-2.jpg',
  'assets/cutscenes/ch3-3.jpg','assets/cutscenes/ch3-4.jpg',
  'assets/cutscenes/ch4-1.jpg','assets/cutscenes/ch4-2.jpg',
  'assets/cutscenes/ch4-3.jpg','assets/cutscenes/ch4-4.jpg',
  // Ch5 stills pending (Sahil, Gemini) — safe to list now, pre-warm skips missing files.
  // 6 shots (not 4) — Ch5 caps Act 1, first VO chapter since the Awakening, gets more room.
  'assets/cutscenes/ch5-1.jpg','assets/cutscenes/ch5-2.jpg',
  'assets/cutscenes/ch5-3.jpg','assets/cutscenes/ch5-4.jpg',
  'assets/cutscenes/ch5-5.jpg','assets/cutscenes/ch5-6.jpg',
  'assets/audio/ch5-1.mp3','assets/audio/ch5-2.mp3',
  'assets/audio/ch5-3.mp3','assets/audio/ch5-4.mp3',
  'assets/audio/ch5-5.mp3','assets/audio/ch5-6.mp3',
];

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== ASSET_CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
  // Non-blocking: pre-warm ONLY missing images — a warm asset cache survives
  // version bumps, so updates no longer re-download megabytes over mobile data
  caches.open(ASSET_CACHE).then(cache => {
    BG_IMAGES.forEach(img => {
      cache.match(BASE + img).then(hit => {
        if (hit) return;
        fetch(BASE + img)
          .then(res => { if (res && res.status === 200) cache.put(BASE + img, res); })
          .catch(() => {});
      });
    });
  });
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never cache Supabase API calls — always fetch live
  if (url.hostname.includes('supabase.co')) return;
  const isHTML = e.request.headers.get('Accept')?.includes('text/html')
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');

  if (isHTML) {
    // Stale-while-revalidate for HTML — serve the cached shell instantly (Duolingo-style
    // app-shell load), refresh the cache in the background for next visit. Safe because
    // CACHE_NAME is bumped every deploy and old caches are wiped on activate, so a fresh
    // network fetch always happens at least once per version.
    // NOTE: Cannot use new Request(navigate-mode-request, ...) — throws TypeError.
    // Fetch by URL string instead.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(url.href, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached || caches.match(BASE));
        return cached || network;
      })
    );
    return;
  }

  // Cache-first for all other assets — images/fonts go to the persistent
  // asset cache (survives deploys); everything else stays version-scoped
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(_isPersistentAsset(url) ? ASSET_CACHE : CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      });
      // No catch fallback — let asset failures fail cleanly so broken images
      // don't get served as HTML and permanently poison the cache
    })
  );
});

// Notification type → vibration pattern + behaviour
const NOTIF_CFG = {
  // Server-push types
  streak_reminder:    { vibrate: [200,100,200,100,200], tag: 'weebji-streak',   requireInteraction: false },
  boss_taunt:         { vibrate: [300,80,120,80,300],   tag: 'weebji-boss',     requireInteraction: false },
  day2_transmission:  { vibrate: [80,60,80,60,240],     tag: 'weebji-ch2',      requireInteraction: true  },
  day3_transmission:  { vibrate: [80,60,80,60,240],     tag: 'weebji-ch3',      requireInteraction: true  },
  day5_transmission:  { vibrate: [80,60,80,60,240],     tag: 'weebji-ch4',      requireInteraction: true  },
  day7_transmission:  { vibrate: [80,60,80,60,240],     tag: 'weebji-ch5',      requireInteraction: true  },
  hp_critical:        { vibrate: [400,150,400,150,800], tag: 'weebji-hp',       requireInteraction: true  },
  power_window:       { vibrate: [100,50,100],          tag: 'weebji-power',    requireInteraction: false },
  morning_activation: { vibrate: [100,50,100,50,100],   tag: 'weebji-morning',  requireInteraction: false },
  daily_complete:     { vibrate: [80,40,80,40,300],     tag: 'weebji-complete', requireInteraction: false },
  comeback:           { vibrate: [300,200,300,200,300], tag: 'weebji-comeback', requireInteraction: true  },
  comeback_3d:        { vibrate: [300,200,300,200,300], tag: 'weebji-comeback', requireInteraction: true  },
  comeback_7d:        { vibrate: [300,200,300,200,300], tag: 'weebji-comeback', requireInteraction: true  },
  ghost_token:        { vibrate: [200,100,200,100,400], tag: 'weebji-ghost',    requireInteraction: true  },
  rank_drop:          { vibrate: [200,100,300,100,200], tag: 'weebji-rank',     requireInteraction: false },
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

// ── SERVER PUSH ──────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let payload = {};
  try { payload = e.data?.json() || {}; } catch { payload = { type: 'morning_activation' }; }
  const type  = payload.type || 'morning_activation';
  const title = payload.title || 'WEEBJI OS';
  const body  = payload.body  || 'The System is watching.';
  const cfg   = NOTIF_CFG[type] || { vibrate: [150, 80, 150], tag: 'weebji-push', requireInteraction: false };
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               BASE + 'icons/icon-192.png',
      badge:              BASE + 'icons/badge-96.png',
      tag:                cfg.tag,
      renotify:           true,
      vibrate:            cfg.vibrate,
      requireInteraction: cfg.requireInteraction,
      data:               { url: BASE, type },
    })
  );
});

// Notification click — focus app window
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || BASE;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(BASE) && 'focus' in c);
      return existing ? existing.focus() : clients.openWindow(target);
    })
  );
});
