import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Called daily by pg_cron — re-verifies every active Play subscription
// and extends expires_at or marks cancelled so users never lose access mid-cycle.

const PLAN_TO_SKU: Record<string, string> = {
  plus:        'weebji_plus_monthly',
  plus_annual: 'weebji_plus_annual',
};

async function getGoogleAccessToken(serviceAccountKey: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };
  const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedHeader  = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const pemBody  = serviceAccountKey.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const encodedSig = b64url(String.fromCharCode(...new Uint8Array(sig)));
  const jwt = `${signingInput}.${encodedSig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token, error } = await res.json();
  if (!access_token) throw new Error(`Google auth failed: ${error}`);
  return access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  // Cron secret auth
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-weebji-cron') !== cronSecret) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const serviceAccountRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountRaw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not set');
    const serviceAccountKey = JSON.parse(serviceAccountRaw);
    const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME');
    if (!packageName) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not set');

    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    const authHeader  = { Authorization: `Bearer ${accessToken}` };
    const playBase    = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

    // Fetch all active Play subscriptions that have a purchase token
    const { data: plans, error: plansErr } = await sb
      .from('user_plans')
      .select('id, user_id, plan, payment_id, expires_at')
      .eq('status', 'active')
      .in('plan', ['plus', 'plus_annual'])
      .not('payment_id', 'is', null);

    if (plansErr) throw plansErr;
    if (!plans?.length) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    let renewed = 0, cancelled = 0, errors = 0;

    for (const row of plans) {
      const sku = PLAN_TO_SKU[row.plan];
      if (!sku) continue;

      try {
        const res = await fetch(
          `${playBase}/${packageName}/purchases/subscriptions/${sku}/tokens/${row.payment_id}`,
          { headers: authHeader }
        );

        if (!res.ok) {
          // 404 = token gone (cancelled long ago), treat as cancelled
          if (res.status === 404 || res.status === 410) {
            await sb.from('user_plans').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', row.id);
            cancelled++;
          } else {
            errors++;
          }
          continue;
        }

        const purchase = await res.json();
        const expMs = parseInt(purchase.expiryTimeMillis || '0');

        if (!expMs) { errors++; continue; }

        const newExpiry = new Date(expMs).toISOString();

        // Still active (paymentState 1=paid, 2=free trial) and not expired
        if ((purchase.paymentState === 1 || purchase.paymentState === 2) && expMs > Date.now()) {
          await sb.from('user_plans').update({
            expires_at: newExpiry,
            status:     'active',
            updated_at: new Date().toISOString(),
          }).eq('id', row.id);
          renewed++;
        } else {
          // Subscription lapsed — grace period: give 24h buffer before revoking
          const graceCutoff = Date.now() - 24 * 60 * 60 * 1000;
          if (expMs < graceCutoff) {
            await sb.from('user_plans').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', row.id);
            cancelled++;
          }
          // Within 24h grace — leave active, will catch on next daily run
        }
      } catch (e) {
        console.error('refresh error for', row.user_id, (e as Error).message);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: plans.length, renewed, cancelled, errors }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
