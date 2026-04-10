import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SKU → plan mapping (must match Play Console product IDs)
const SKU_TO_PLAN: Record<string, string> = {
  weebji_plus_monthly: 'plus',
  weebji_plus_annual:  'plus_annual',
  weebji_ghost_token:  'ghost_token',
};

const SUBSCRIPTION_SKUS = new Set(['weebji_plus_monthly', 'weebji_plus_annual']);

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

  // Import RSA private key
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

  // Exchange JWT for access token
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    // Decode JWT to get user id — purchase token from Google Play is the real security gate
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!payload.sub) throw new Error('no sub');
      userId = payload.sub;
    } catch(e) {
      return new Response(JSON.stringify({ error: 'Invalid token', detail: (e as Error).message }), { status: 401, headers: CORS });
    }
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { purchaseToken, sku, plan } = await req.json();
    if (!purchaseToken || !sku) return new Response(JSON.stringify({ error: 'Missing purchaseToken or sku' }), { status: 400, headers: CORS });

    const dbPlan = SKU_TO_PLAN[sku];
    if (!dbPlan) return new Response(JSON.stringify({ error: 'Unknown SKU' }), { status: 400, headers: CORS });

    // Load Google service account key
    const serviceAccountRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountRaw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not set');
    const serviceAccountKey = JSON.parse(serviceAccountRaw);

    const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME');
    if (!packageName) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not set');

    let accessToken: string;
    try {
      accessToken = await getGoogleAccessToken(serviceAccountKey);
    } catch(e) {
      throw new Error('Google auth failed: ' + (e as Error).message);
    }
    const authBearerH = { Authorization: `Bearer ${accessToken}` };
    const playBase    = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

    const isSubscription = SUBSCRIPTION_SKUS.has(sku);
    let expiresAt: string | null = null;

    if (isSubscription) {
      // Verify subscription
      let verifyRes: Response;
      try {
        verifyRes = await fetch(
          `${playBase}/${packageName}/purchases/subscriptions/${sku}/tokens/${purchaseToken}`,
          { headers: authBearerH }
        );
      } catch(e) {
        throw new Error('Play fetch failed: ' + (e as Error).message);
      }
      if (!verifyRes.ok) {
        const err = await verifyRes.text();
        throw new Error(`Play verify failed (${verifyRes.status}): ${err}`);
      }
      const purchase = await verifyRes.json();
      // paymentState 1 = payment received, 2 = free trial
      if (purchase.paymentState !== 1 && purchase.paymentState !== 2) {
        return new Response(JSON.stringify({ error: 'Payment not received' }), { status: 402, headers: CORS });
      }
      // Store expiry time from Google Play
      if (purchase.expiryTimeMillis) {
        expiresAt = new Date(parseInt(purchase.expiryTimeMillis)).toISOString();
      }
      // Acknowledge if not yet acknowledged
      if (purchase.acknowledgementState === 0) {
        await fetch(
          `${playBase}/${packageName}/purchases/subscriptions/${sku}/tokens/${purchaseToken}:acknowledge`,
          { method: 'POST', headers: authBearerH }
        );
      }
    } else {
      // Verify one-time product (ghost token)
      const verifyRes = await fetch(
        `${playBase}/${packageName}/purchases/products/${sku}/tokens/${purchaseToken}`,
        { headers: authBearerH }
      );
      if (!verifyRes.ok) {
        const err = await verifyRes.text();
        throw new Error(`Play verify failed: ${err}`);
      }
      const purchase = await verifyRes.json();
      if (purchase.purchaseState !== 0) { // 0 = purchased
        return new Response(JSON.stringify({ error: 'Purchase not completed' }), { status: 402, headers: CORS });
      }
      // Consume so it can be purchased again
      await fetch(
        `${playBase}/${packageName}/purchases/products/${sku}/tokens/${purchaseToken}:consume`,
        { method: 'POST', headers: authBearerH }
      );
    }

    // Activate plan in DB
    if (dbPlan === 'ghost_token') {
      // Increment ghost_tokens — check error via destructuring (Supabase client doesn't throw)
      const { error: rpcError } = await adminClient.rpc('increment_ghost_tokens', { uid: userId });
      if (rpcError) {
        // Fallback: manual increment
        const { data: prog } = await adminClient.from('progress').select('ghost_tokens').eq('user_id', userId).single();
        const current = (prog?.ghost_tokens as number) || 0;
        await adminClient.from('progress').upsert(
          { user_id: userId, ghost_tokens: current + 1, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }
    } else {
      // Upsert subscription plan with expiry
      await adminClient.from('user_plans').upsert(
        {
          user_id:    userId,
          plan:       dbPlan,
          status:     'active',
          payment_id: purchaseToken,
          email:      null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }

    return new Response(JSON.stringify({ success: true, plan: dbPlan }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
