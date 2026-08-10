import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-weebji-cron',
};

const NOTIF: Record<string, { title: string; body: string }> = {
  morning_activation: { title: '◈ SYSTEM ONLINE',         body: "Today's protocol is waiting. Don't let the streak die." },
  streak_reminder:    { title: 'SYSTEM ALERT',             body: "You haven't trained today. Your streak dies at midnight." },
  midday_check:       { title: '◈ MID-SESSION CHECK',     body: "Half the day is gone. You still haven't trained. Fix that." },
  daily_complete:     { title: '◆ DIRECTIVE COMPLETE',    body: "Today's protocol is complete. The System acknowledges you." },
  comeback_2d:        { title: '◈ ABSENCE DETECTED',      body: 'The System has noticed your absence. 48 hours of silence. Return before the void settles in.' },
  comeback_5d:        { title: 'SIGNAL LOST — DAY 5',     body: 'Five days dark. Hunters are passing you on the leaderboard. The System holds your place — barely. Reconnect.' },
  comeback_10d:       { title: '⚠ FINAL TRANSMISSION',    body: 'Ten days of silence. Most never return. Prove you are not most. One session reactivates everything.' },
  weekly_start:       { title: '◈ NEW WEEK DETECTED',     body: "Fresh week. Zero excuses. The System is watching from day one." },
  midweek_check:      { title: 'MIDWEEK STATUS',           body: "Wednesday. Still time to make this week count. Are you training?" },
  week_close:         { title: '⚠ WEEK CLOSES TONIGHT',   body: "Sunday ends in hours. Don't let this week die without a session." },
  streak5_trial_ending: { title: '⏳ YOUR FREE TRIAL IS ENDING', body: 'Your 7-day WEEBJI+ trial ends in 2 days. Subscribe now so you never lose what you unlocked.' },
  streak5_trial_ended:  { title: '◆ YOUR FREE TRIAL HAS ENDED', body: "WEEBJI+ access has reverted to free tier. You know what you had — now go get it back." },
  boss_taunt:           { title: '⚔ THE BOSS TAUNTS YOU',       body: 'No damage dealt today. The siege will not win itself.' },
  day2_transmission:    { title: '◈ INCOMING TRANSMISSION',     body: 'A signal awaits, Hunter. The System has something you should see. Open the channel.' },
  day3_transmission:    { title: '◈ INCOMING TRANSMISSION',     body: 'You were not the first to be chosen, Hunter. The archive has opened. See who stood where you stand.' },
  day5_transmission:    { title: '◈ INCOMING TRANSMISSION',     body: 'Disclosure protocol is open, Hunter. The System has named what took the ones who stopped. Come and hear it.' },
  day7_transmission:    { title: '◈ INCOMING TRANSMISSION',     body: 'The naming ceremony is ready, Hunter. Seven cycles unbroken. Come and be named.' },
};

// Weekly siege boss roster — MUST mirror DUNGEONS order + week math in index.html
// (BossSiege._getWeekKey / _bossForWeek) or the taunt names the wrong boss.
const BOSSES = [
  'THE IRON WARDEN', 'THE VOID ARCHITECT', 'THE HOLLOW KING', 'THE SILENT SOVEREIGN',
  'THE CRIMSON BEAST', 'THE OBSIDIAN MONK', 'THE PLAGUE DOCTOR', 'THE ASHEN TITAN',
  'THE FRACTURED MIRROR', 'THE ETERNAL HUNTER',
];
const TAUNTS = [
  'Midday, and not a scratch on me. I was told you were dangerous.',
  'You have dealt no damage today. I would mock you, but silence says it better.',
  'The walls hold. The hunter hides. Come test me.',
  'Every hour you wait, I stand taller. Strike before dusk.',
  'Your siege has gone quiet. Shall I tell the leaderboard you surrendered?',
];
const BOSS_TAUNT_LOCAL_HOUR = 13;
// Ch2/Ch3/Ch4/Ch5 chapter appointments (STORY_BIBLE): the push IS the transmission.
// day2 targets signups 24-48h old, day3 48-72h, day5 96-120h, day7 144-168h — all at local evening.
const DAY2_LOCAL_HOUR = 18;

function bossThisWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return BOSSES[(weekNum - 1) % BOSSES.length];
}

// Re-engagement bands: comeback_Nd targets users whose last sync is N..N+1 days old.
// Cron fires hourly; we only push band users whose LOCAL hour is 17 (5pm their evening,
// any timezone). One-day band x one 5pm per day = exactly one push per stage (2/5/10),
// never the twice-daily repeat spam the old 3d/7d types caused.
const COMEBACK_DAYS: Record<string, number> = { comeback_2d: 2, comeback_5d: 5, comeback_10d: 10 };
const COMEBACK_LOCAL_HOUR = 17;

// morning_activation/streak_reminder used to fire 4x/day each (8 nags/day to anyone
// who hadn't trained) — Android demotes/mutes channels that spam like that. Now each
// cron fires hourly but only sends once per day, at the user's local hour below.
const MORNING_LOCAL_HOUR = 9;
const STREAK_LOCAL_HOUR  = 20;

// midday_check / midweek_check / week_close shipped with copy but no targeting:
// midday_check fell through to `return true` and the other two to the catch-all
// "every subscription" branch. Either one on an hourly cron = up to 24 pushes a
// day per user. Same gate as every other type — cron fires hourly, the hour picks
// the single send. All three are untrained-users-only (the trainedToday check above).
const MIDDAY_LOCAL_HOUR     = 12;
const MIDWEEK_LOCAL_HOUR    = 18; // Wednesday only
const WEEK_CLOSE_LOCAL_HOUR = 19; // Sunday only

// Same Doze-deferral fix send-push already has — without this, Android can sit on
// the push for hours and it lands well after the "haven't trained today" window meant it for.
const PUSH_OPTS = { TTL: 86400, urgency: 'high' as const };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let type: string | null = null;
    try { type = (await req.json())?.type ?? null; } catch { /* no body */ }
    if (!type) type = new URL(req.url).searchParams.get('type');
    if (!type || !NOTIF[type]) {
      return new Response('Missing or invalid type', { status: 400 });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    webpush.setVapidDetails(
      'mailto:weebjiglobal@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );

    const now = new Date();
    const todayUTC = now.toISOString().slice(0, 10);

    function localToday(tz: string | null): string {
      try {
        if (!tz) return todayUTC;
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      } catch { return todayUTC; }
    }

    function localHour(tz: string | null): number {
      try {
        return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', hour12: false }).format(now));
      } catch { return now.getUTCHours(); }
    }

    // 0=Sun..6=Sat in the USER's timezone — a UTC weekday would fire midweek/week_close
    // on the wrong day for anyone far enough east or west.
    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function localWeekday(tz: string | null): number {
      try {
        return WEEKDAYS.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', weekday: 'short' }).format(now));
      } catch { return now.getUTCDay(); }
    }

    let userIds: string[] = [];
    let streakMap = new Map<string, number>();

    if (type === 'morning_activation' || type === 'streak_reminder' || type === 'midday_check' || type === 'daily_complete' || type === 'boss_taunt' || type === 'midweek_check' || type === 'week_close') {
      const { data: subs } = await sb.from('push_subscriptions').select('user_id, timezone');
      const allIds = (subs || []).map(r => r.user_id);
      if (allIds.length) {
        const { data: prog } = await sb.from('progress').select('user_id, last_trained_date, streak, updated_at').in('user_id', allIds);
        const trainedMap = new Map((prog || []).map(r => [r.user_id, r.last_trained_date as string | null]));
        const updatedMap = new Map((prog || []).map(r => [r.user_id, r.updated_at as string | null]));
        streakMap = new Map((prog || []).map(r => [r.user_id, (r.streak as number | null) || 0]));
        const tzMap = new Map((subs || []).map(r => [r.user_id, r.timezone as string | null]));
        userIds = allIds.filter(id => {
          const tz = tzMap.get(id) ?? null;
          const trained = trainedMap.get(id);
          const trainedToday = !!trained && trained >= localToday(tz);
          if (type === 'daily_complete') return trainedToday && localHour(tz) === STREAK_LOCAL_HOUR;
          if (trainedToday) return false;
          if (type === 'morning_activation') return localHour(tz) === MORNING_LOCAL_HOUR;
          if (type === 'streak_reminder')    return localHour(tz) === STREAK_LOCAL_HOUR;
          // Boss damage only comes from checks, so "untrained today" ≈ "hasn't
          // struck the boss today" — the server can't see localStorage boss HP.
          // Active-users-only (synced <72h): lapsed users belong to the comeback
          // bands' 3 single touches, not a daily taunt forever.
          if (type === 'boss_taunt') {
            const upd = updatedMap.get(id);
            const active = !!upd && (Date.now() - new Date(upd).getTime()) < 72 * 3600 * 1000;
            return active && localHour(tz) === BOSS_TAUNT_LOCAL_HOUR;
          }
          if (type === 'midday_check')  return localHour(tz) === MIDDAY_LOCAL_HOUR;
          if (type === 'midweek_check') return localWeekday(tz) === 3 && localHour(tz) === MIDWEEK_LOCAL_HOUR;
          if (type === 'week_close')    return localWeekday(tz) === 0 && localHour(tz) === WEEK_CLOSE_LOCAL_HOUR;
          return true;
        });
      }
    } else if (COMEBACK_DAYS[type]) {
      const days = COMEBACK_DAYS[type];
      const bandNewer = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const bandOlder = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await sb.from('progress').select('user_id')
        .lt('updated_at', bandNewer).gte('updated_at', bandOlder);
      const bandIds = (rows || []).map(r => r.user_id);
      if (bandIds.length) {
        const { data: tzRows } = await sb.from('push_subscriptions').select('user_id, timezone').in('user_id', bandIds);
        const eveningNow = new Set((tzRows || []).filter(r => localHour(r.timezone) === COMEBACK_LOCAL_HOUR).map(r => r.user_id));
        userIds = bandIds.filter(id => eveningNow.has(id));
      }
    } else if (type === 'day2_transmission' || type === 'day3_transmission' || type === 'day5_transmission' || type === 'day7_transmission') {
      // progress has no created_at — signup time lives in auth.users (admin API)
      const [ageMinH, ageMaxH] = type === 'day2_transmission' ? [24, 48] : type === 'day3_transmission' ? [48, 72] : type === 'day5_transmission' ? [96, 120] : [144, 168];
      const { data: usersPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const d2Ids = (usersPage?.users || [])
        .filter(u => {
          const age = Date.now() - new Date(u.created_at).getTime();
          return age >= ageMinH * 3600 * 1000 && age < ageMaxH * 3600 * 1000;
        })
        .map(u => u.id);
      if (d2Ids.length) {
        const { data: tzRows } = await sb.from('push_subscriptions').select('user_id, timezone').in('user_id', d2Ids);
        userIds = (tzRows || []).filter(r => localHour(r.timezone) === DAY2_LOCAL_HOUR).map(r => r.user_id);
      }
    } else if (type === 'streak5_trial_ending' || type === 'streak5_trial_ended') {
      // ending: trial started 5-6 days ago (~2 days left) | ended: started 7-8 days ago (just lapsed)
      const [daysAgoMin, daysAgoMax] = type === 'streak5_trial_ending' ? [5, 6] : [7, 8];
      const cutoffOld = now.getTime() - daysAgoMax * 24 * 60 * 60 * 1000;
      const cutoffNew = now.getTime() - daysAgoMin * 24 * 60 * 60 * 1000;
      const { data: rows }   = await sb.from('progress').select('user_id, data');
      const { data: lbRows } = await sb.from('leaderboard').select('user_id, is_plus');
      const plusSet = new Set((lbRows || []).filter(r => r.is_plus).map(r => r.user_id));
      userIds = (rows || [])
        .filter(r => {
          if (plusSet.has(r.user_id)) return false;
          const ts = parseInt((r.data as Record<string, unknown> | null)?.streak5TrialStart as string || '0');
          return ts > 0 && ts >= cutoffOld && ts <= cutoffNew;
        })
        .map(r => r.user_id);
    } else {
      const { data: subs } = await sb.from('push_subscriptions').select('user_id');
      userIds = (subs || []).map(r => r.user_id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, targeted: 0, sent: 0, failed: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error: subErr } = await sb
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);
    if (subErr) throw subErr;

    const { title, body } = NOTIF[type];

    let sent = 0, failed = 0;
    for (const sub of (subs || [])) {
      let pBody = body, pTitle = title;
      if (type === 'boss_taunt') {
        pTitle = `⚔ ${bossThisWeek()} TAUNTS YOU`;
        pBody  = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
      }
      if (type === 'daily_complete') {
        const streak = streakMap.get(sub.user_id) || 0;
        pBody = streak > 0
          ? `Day ${streak} secured. The System acknowledges your discipline.`
          : body;
      }
      if (type === 'morning_activation') {
        const streak = streakMap.get(sub.user_id) || 0;
        if (streak === 0) pBody = 'YOUR FIRST DIRECTIVE HAS BEEN ASSIGNED. REPORT IN NOW AND CLAIM IT.';
      }
      if (type === 'streak_reminder') {
        const streak = streakMap.get(sub.user_id) || 0;
        if (streak === 1) pBody = 'DAY 1 STREAK ON THE LINE. One day built. Don\'t let it die tonight — train before midnight.';
      }
      const payload = JSON.stringify({ type, title: pTitle, body: pBody });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          PUSH_OPTS,
        );
        sent++;
      } catch (e: unknown) {
        failed++;
        const _sc = (e as { statusCode?: number }).statusCode;
        console.error('webpush error', sub.endpoint?.slice(-20), (e as Error).message, _sc);
        // 404 is as terminal as 410 — FCM returns it for an unknown registration.
        // Pruning only on 410 left dead endpoints in the table forever, so every
        // later send retried them and logged a failure that could never clear.
        if (_sc === 410 || _sc === 404) {
          try { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch { /* ignore */ }
        }
      }
    }

    try {
      // targeted counts USERS, recipients counts SUBSCRIPTIONS — a targeted user with
      // no push row can never be a recipient, so the raw ratio reads as false failure.
      // Record the sub count so the gap is attributable.
      // `attempted` is that sub count persisted on EVERY fire, not just failing ones —
      // it used to live only inside the error text, so a clean run threw away the one
      // number that makes a delivery rate computable. recipients/attempted is the real
      // rate (same units); recipients/targeted is NOT and will read >100% for anyone
      // running two devices. Muting shows up as attempted flat while recipients falls.
      await sb.from('push_log').insert({ type, targeted: userIds.length, attempted: subs?.length ?? 0, recipients: sent, ok: sent > 0, error: failed > 0 ? `${failed} failed of ${subs?.length ?? 0} subs` : null });
    } catch { /* table may not exist */ }

    return new Response(JSON.stringify({ ok: true, targeted: userIds.length, subscriptions: subs?.length ?? 0, sent, failed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e: unknown) {
    try {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await sb.from('push_log').insert({ type: 'unknown', targeted: 0, recipients: 0, ok: false, error: (e as Error).message });
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
