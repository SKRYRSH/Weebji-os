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
  comeback_3d:        { title: 'RECONNECTION REQUIRED',    body: 'Your guild noticed you went dark. 3 days offline. Come back.' },
  comeback_7d:        { title: 'RANK SLIPPING',            body: "Someone took your spot on the leaderboard. 7 days gone. Return now." },
  weekly_start:       { title: '◈ NEW WEEK DETECTED',     body: "Fresh week. Zero excuses. The System is watching from day one." },
  midweek_check:      { title: 'MIDWEEK STATUS',           body: "Wednesday. Still time to make this week count. Are you training?" },
  week_close:         { title: '⚠ WEEK CLOSES TONIGHT',   body: "Sunday ends in hours. Don't let this week die without a session." },
};

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
    // IST midnight = UTC 18:30 previous day
    const istMidnightUTC = new Date(now);
    istMidnightUTC.setUTCHours(18, 30, 0, 0);
    if (istMidnightUTC > now) istMidnightUTC.setUTCDate(istMidnightUTC.getUTCDate() - 1);
    const todayISTStart  = istMidnightUTC.toISOString();
    const threeDaysAgo   = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find target user_ids — pull from push_subscriptions directly so streak=0 users still get notified
    let userIds: string[] = [];

    if (type === 'morning_activation' || type === 'streak_reminder' || type === 'midday_check') {
      // All subscribed users who haven't trained today — regardless of streak
      const { data: subs } = await sb.from('push_subscriptions').select('user_id');
      const allIds = (subs || []).map(r => r.user_id);
      if (allIds.length) {
        const { data: prog } = await sb.from('progress').select('user_id').in('user_id', allIds).lt('updated_at', todayISTStart);
        userIds = (prog || []).map(r => r.user_id);
        // Include subscribed users with no progress row at all (brand new)
        const hasProgress = new Set(userIds);
        allIds.forEach(id => { if (!hasProgress.has(id)) userIds.push(id); });
      }
    } else if (type === 'comeback_3d') {
      const { data: rows } = await sb.from('progress').select('user_id').lt('updated_at', threeDaysAgo).gte('updated_at', sevenDaysAgo);
      userIds = (rows || []).map(r => r.user_id);
    } else if (type === 'comeback_7d') {
      const { data: rows } = await sb.from('progress').select('user_id').lt('updated_at', sevenDaysAgo);
      userIds = (rows || []).map(r => r.user_id);
    } else {
      // weekly_* — all subscribed users
      const { data: subs } = await sb.from('push_subscriptions').select('user_id');
      userIds = (subs || []).map(r => r.user_id);
    }
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, targeted: 0, sent: 0, failed: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch push subscriptions for these users
    const { data: subs, error: subErr } = await sb
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);
    if (subErr) throw subErr;

    const { title, body } = NOTIF[type];
    const payload = JSON.stringify({ type, title, body });

    let sent = 0, failed = 0;
    for (const sub of (subs || [])) {
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

    // Best-effort log
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
