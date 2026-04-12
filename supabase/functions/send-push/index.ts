import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTIF: Record<string, (e: Record<string, unknown>) => { title: string; body: string }> = {
  streak_reminder:    () => ({ title: 'SYSTEM ALERT', body: 'Your streak is waiting. Train today or lose it.' }),
  hp_critical:        () => ({ title: '⚠ CRITICAL HP', body: 'One HP remaining. Miss today and the System resets you.' }),
  power_window:       () => ({ title: '⚡ POWER WINDOW', body: 'Peak conditions detected. The System recommends immediate action.' }),
  morning_activation: () => ({ title: '◈ SYSTEM ONLINE', body: 'The gates are open. Your protocol awaits.' }),
  comeback:           () => ({ title: 'RECONNECTION REQUIRED', body: 'You have been offline. The System has logged the gap. Return now.' }),
  ghost_token:        () => ({ title: '👻 GHOST TOKENS DEPLETED', body: 'No protection remains. Miss today and your streak becomes ash.' }),
  level_up:           (e) => ({ title: `LEVEL ${e.level || '??'} ACHIEVED`, body: 'Evolution confirmed. The System has upgraded your rank.' }),
  secret_title:       (e) => ({ title: '◆ SECRET TITLE UNLOCKED', body: `"${e.title || 'Unknown'}" — The System acknowledges your worth.` }),
  weekly_summary:     (e) => ({ title: '◈ WEEKLY SYSTEM REPORT', body: `Level ${e.level || '?'} · ${e.streak || 0}-day streak. Progress logged.` }),
  penance:            () => ({ title: '🔴 PENANCE PROTOCOL ACTIVE', body: 'You failed. The System offers one chance at redemption. Speak.' }),
  streak_7:           () => ({ title: '🔥 7-DAY STREAK', body: 'One week of unbroken discipline. The System has noticed.' }),
  streak_30:          () => ({ title: '⚡ 30-DAY STREAK', body: 'One month. Very few reach this. The System promotes your standing.' }),
  streak_100:         () => ({ title: '💎 100-DAY STREAK', body: 'Triple digits. You are no longer ordinary. The System acknowledges.' }),
  streak_365:         () => ({ title: '👑 ONE FULL YEAR', body: '365 days. The System has never met your equal. Legend confirmed.' }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { user_id, type, ...extras } = await req.json();
    if (!user_id || !type) return new Response('Missing user_id or type', { status: 400, headers: CORS });
    if (user_id !== user.id) return new Response('Forbidden', { status: 403, headers: CORS });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: subs } = await sb.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', user_id);
    if (!subs?.length) return new Response(JSON.stringify({ ok: false, reason: 'no_subscription' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    webpush.setVapidDetails(
      'mailto:weebjiglobal@gmail.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );

    const templateFn = NOTIF[type];
    const { title, body } = templateFn ? templateFn(extras) : { title: 'WEEBJI OS', body: 'The System is watching.' };
    const payload = JSON.stringify({ type, title, body });

    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (e: unknown) {
        failed++;
        if ((e as { statusCode?: number }).statusCode === 410) {
          try { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch { /* ignore */ }
        }
      }
    }

    return new Response(JSON.stringify({ ok: sent > 0, sent, failed }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
