import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-weebji-cron',
};

const ONE_SIGNAL_APP_ID = 'd01da00b-3bb3-4b2f-812a-3042d915da12';
const ONE_SIGNAL_API    = 'https://onesignal.com/api/v1/notifications';

// Duolingo-style guilt-trip copy — short, punchy, on-brand
const NOTIF: Record<string, { title: string; body: string }> = {
  morning_activation: { title: '◈ SYSTEM ONLINE',          body: "Today's protocol is waiting. Don't let the streak die." },
  streak_reminder:    { title: 'SYSTEM ALERT',              body: "You haven't trained today. Your streak dies at midnight." },
  midday_check:       { title: '◈ MID-SESSION CHECK',      body: "Half the day is gone. You still haven't trained. Fix that." },
  comeback_3d:        { title: 'RECONNECTION REQUIRED',     body: 'Your guild noticed you went dark. 3 days offline. Come back.' },
  comeback_7d:        { title: 'RANK SLIPPING',             body: "Someone took your spot on the leaderboard. 7 days gone. Return now." },
  weekly_start:       { title: '◈ NEW WEEK DETECTED',      body: "Fresh week. Zero excuses. The System is watching from day one." },
  midweek_check:      { title: 'MIDWEEK STATUS',            body: "Wednesday. Still time to make this week count. Are you training?" },
  week_close:         { title: '⚠ WEEK CLOSES TONIGHT',    body: "Sunday ends in hours. Don't let this week die without a session." },
};

async function sendOneSignal(userIds: string[], type: string) {
  if (userIds.length === 0) return { ok: true, recipients: 0, osError: null };
  const notif = NOTIF[type];
  // Batch in chunks of 2000 (OneSignal limit per request)
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 2000) chunks.push(userIds.slice(i, i + 2000));

  let totalRecipients = 0;
  let lastError: string | null = null;
  for (const chunk of chunks) {
    const res = await fetch(ONE_SIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
      },
      body: JSON.stringify({
        app_id: ONE_SIGNAL_APP_ID,
        include_external_user_ids: chunk,
        channel_for_external_user_ids: 'push',
        headings: { en: notif.title },
        contents: { en: notif.body },
        url: 'https://skryrsh.github.io/Weebji-os/',
      }),
    });
    const json = await res.json();
    totalRecipients += json.recipients || 0;
    if (!res.ok || json.errors) {
      lastError = JSON.stringify(json.errors || json);
    }
  }
  return { ok: lastError === null, recipients: totalRecipients, osError: lastError };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    let type: string | null = null;
    try { type = (await req.json())?.type ?? null; } catch { /* no body */ }
    if (!type) type = new URL(req.url).searchParams.get('type');
    if (!type || !NOTIF[type]) {
      return new Response('Missing or invalid type', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    // IST midnight = UTC 18:30 previous day
    const istMidnightUTC = new Date(now);
    istMidnightUTC.setUTCHours(18, 30, 0, 0);
    if (istMidnightUTC > now) istMidnightUTC.setUTCDate(istMidnightUTC.getUTCDate() - 1);
    const todayISTStart = istMidnightUTC.toISOString();
    const threeDaysAgo  = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Query relevant users from progress table
    let query = supabase.from('progress').select('user_id, streak, updated_at');

    if (type === 'morning_activation' || type === 'streak_reminder' || type === 'midday_check') {
      // Users with active streaks who haven't trained today
      query = query.gt('streak', 0).lt('updated_at', todayISTStart);
    } else if (type === 'comeback_3d') {
      // Inactive 3-7 days (not 7+ — those get comeback_7d)
      query = query.lt('updated_at', threeDaysAgo).gte('updated_at', sevenDaysAgo);
    } else if (type === 'comeback_7d') {
      query = query.lt('updated_at', sevenDaysAgo);
    }
    // weekly_start / midweek_check / week_close — all active users (no filter)

    const { data: rows, error } = await query;
    if (error) throw error;

    const userIds = (rows || []).map(r => r.user_id);
    const result = await sendOneSignal(userIds, type);

    // push_log is best-effort — don't crash the job if table is missing
    try {
      await supabase.from('push_log').insert({
        type,
        targeted:   userIds.length,
        recipients: result.recipients,
        ok:         result.ok,
        error:      result.osError,
      });
    } catch { /* table may not exist yet */ }

    return new Response(JSON.stringify({ ok: true, targeted: userIds.length, ...result }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // Best-effort error log — use service role client directly
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
