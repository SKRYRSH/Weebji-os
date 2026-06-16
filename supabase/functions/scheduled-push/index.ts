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
};

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

    let userIds: string[] = [];
    let streakMap = new Map<string, number>();

    if (type === 'morning_activation' || type === 'streak_reminder' || type === 'midday_check' || type === 'daily_complete') {
      const { data: subs } = await sb.from('push_subscriptions').select('user_id, timezone');
      const allIds = (subs || []).map(r => r.user_id);
      if (allIds.length) {
        const { data: prog } = await sb.from('progress').select('user_id, last_trained_date, streak').in('user_id', allIds);
        const trainedMap = new Map((prog || []).map(r => [r.user_id, r.last_trained_date as string | null]));
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
      let pBody = body;
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
      const payload = JSON.stringify({ type, title, body: pBody });
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (e: unknown) {
        failed++;
        console.error('webpush error', sub.endpoint?.slice(-20), (e as Error).message, (e as { statusCode?: number }).statusCode);
        if ((e as { statusCode?: number }).statusCode === 410) {
          try { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch { /* ignore */ }
        }
      }
    }

    try {
      await sb.from('push_log').insert({ type, targeted: userIds.length, recipients: sent, ok: sent > 0, error: failed > 0 ? `${failed} failed` : null });
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
