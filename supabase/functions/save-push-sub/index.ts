import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Saves/rebinds a device's push subscription to the CURRENTLY authenticated user.
// Direct client upserts can't do this: RLS (auth.uid() = user_id) blocks updating
// an endpoint row created under a previously signed-in account, so a device that
// switched accounts kept receiving pushes evaluated against the OLD account's
// progress ("you haven't trained today" despite training — Jul 2026).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { endpoint, p256dh, auth, timezone } = await req.json();
    if (!endpoint || !p256dh || !auth) {
      return new Response('Missing endpoint/p256dh/auth', { status: 400, headers: CORS });
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error: upErr } = await sbAdmin.from('push_subscriptions').upsert({
      user_id:    user.id,
      endpoint,
      p256dh,
      auth,
      timezone:   typeof timezone === 'string' && timezone.length <= 64 ? timezone : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
