// @ts-ignore – npm: specifier supported by Supabase Edge Functions (Deno 1.32+)
import webpush from 'npm:web-push@3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-weebji-cron',
};

const NOTIF: Record<string, (e: Record<string, unknown>) => { title: string; body: string }> = {
  morning_activation: () => ({ title: '◈ SYSTEM ONLINE', body: 'The gates are open. Your protocol awaits.' }),
  streak_reminder:    () => ({ title: 'SYSTEM ALERT', body: 'Your streak is waiting. Train today or lose it.' }),
  comeback:           () => ({ title: 'RECONNECTION REQUIRED', body: 'You have been offline. The System has logged the gap. Return now.' }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Auth: cron secret header
  const cronSecret = Deno.env.get('CRON_SECRET');
  const incoming   = req.headers.get('x-weebji-cron');
  if (!cronSecret || incoming !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url  = new URL(req.url);
    const type = url.searchParams.get('type');
    if (!type || !NOTIF[type]) {
      return new Response('Missing or invalid type param', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
    webpush.setVapidDetails('mailto:weebjiglobal@gmail.com', vapidPublicKey, vapidPrivateKey);

    const now       = new Date();
    // IST midnight = UTC 18:30 previous day
    const istMidnightUTC = new Date(now);
    istMidnightUTC.setUTCHours(18, 30, 0, 0);
    if (istMidnightUTC > now) istMidnightUTC.setUTCDate(istMidnightUTC.getUTCDate() - 1);
    const todayISTStart = istMidnightUTC.toISOString();

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all push subscriptions
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Fetch progress for all subscribed users
    const userIds = subs.map(s => s.user_id);
    const { data: progRows } = await supabase
      .from('progress')
      .select('user_id, streak, updated_at')
      .in('user_id', userIds);

    const progMap: Record<string, { streak: number; updated_at: string }> = {};
    for (const p of progRows || []) progMap[p.user_id] = p;

    let sent = 0;
    let skipped = 0;
    const expired: string[] = [];

    for (const sub of subs) {
      const prog = progMap[sub.user_id];
      if (!prog) { skipped++; continue; }

      const streak    = prog.streak || 0;
      const updatedAt = prog.updated_at || '';
      const notTrained = updatedAt < todayISTStart;
      const inactive3d = updatedAt < threeDaysAgo;

      // Filter: who gets this push
      if (type === 'morning_activation' && !(streak > 0 && notTrained)) { skipped++; continue; }
      if (type === 'streak_reminder'    && !(streak > 0 && notTrained)) { skipped++; continue; }
      if (type === 'comeback'           && !inactive3d)                 { skipped++; continue; }

      const { title, body } = NOTIF[type]({});
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, type }),
        );
        sent++;
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 410) {
          // Expired subscription — clean up
          expired.push(sub.user_id);
        }
        // else: ignore transient failures
        skipped++;
      }
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('user_id', expired);
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, expired: expired.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
