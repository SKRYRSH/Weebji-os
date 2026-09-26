import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SKU_TO_PLAN: Record<string, string> = {
  weebji_plus_monthly:  'plus',
  weebji_plus_annual:   'plus_annual',
  weebji_ghost_token:   'ghost_token',
  weebji_ghost_token_3: 'ghost_token_3',
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the JWT signature server-side (verify_jwt is off for this fn) —
    // a hand-decoded `sub` could be forged to attach a purchase to any account.
    const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid token', detail: authErr?.message || 'no user' }), { status: 401, headers: CORS });
    }
    const userId: string = authData.user.id;

    const { purchaseToken, sku } = await req.json();
    if (!purchaseToken || !sku) return new Response(JSON.stringify({ error: 'Missing purchaseToken or sku' }), { status: 400, headers: CORS });

    const dbPlan = SKU_TO_PLAN[sku];
    if (!dbPlan) return new Response(JSON.stringify({ error: 'Unknown SKU' }), { status: 400, headers: CORS });

    const serviceAccountRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountRaw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not set');
    const serviceAccountKey = JSON.parse(serviceAccountRaw);
    const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME');
    if (!packageName) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not set');

    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    const authBearerH = { Authorization: `Bearer ${accessToken}` };
    const playBase    = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

    const isSubscription = SUBSCRIPTION_SKUS.has(sku);
    let expiresAt: string | null = null;

    if (isSubscription) {
      const verifyRes = await fetch(
        `${playBase}/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
        { headers: authBearerH }
      );
      if (!verifyRes.ok) {
        const err = await verifyRes.text();
        throw new Error(`Play verify failed (${verifyRes.status}): ${err}`);
      }
      const purchase = await verifyRes.json();
      const state = purchase.subscriptionState as string;
      const isActive = state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
      if (!isActive) {
        return new Response(JSON.stringify({ error: 'Payment not received', state }), { status: 402, headers: CORS });
      }
      const lineItem = purchase.lineItems?.[0];
      if (lineItem?.expiryTime) expiresAt = new Date(lineItem.expiryTime).toISOString();
      if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
        await fetch(
          `${playBase}/${packageName}/purchases/subscriptionsv2/tokens/${purchaseToken}:acknowledge`,
          { method: 'POST', headers: authBearerH, body: '{}' }
        );
      }
    } else {
      const verifyRes = await fetch(
        `${playBase}/${packageName}/purchases/products/${sku}/tokens/${purchaseToken}`,
        { headers: authBearerH }
      );
      if (!verifyRes.ok) throw new Error(`Play verify failed: ${await verifyRes.text()}`);
      const purchase = await verifyRes.json();
      if (purchase.purchaseState !== 0) {
        return new Response(JSON.stringify({ error: 'Purchase not completed' }), { status: 402, headers: CORS });
      }
      const consume = () => fetch(
        `${playBase}/${packageName}/purchases/products/${sku}/tokens/${purchaseToken}:consume`,
        { method: 'POST', headers: authBearerH }
      );
      // Idempotency: each purchaseToken grants exactly once. Client retries and
      // the listPurchases reconcile loop can re-send the same token.
      // consumptionState 1 = consumed by the pre-ledger code, which consumed BEFORE granting.
      if (purchase.consumptionState === 1) {
        return new Response(JSON.stringify({ success: true, plan: dbPlan, already: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      const { data: claimed, error: ledgerErr } = await adminClient.from('play_purchase_ledger')
        .upsert({ purchase_token: purchaseToken, user_id: userId, sku }, { onConflict: 'purchase_token', ignoreDuplicates: true })
        .select('purchase_token');
      if (ledgerErr) throw new Error(`ledger: ${ledgerErr.message}`);
      if (!claimed?.length) {
        await consume();
        return new Response(JSON.stringify({ success: true, plan: dbPlan, already: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      const addCount = dbPlan === 'ghost_token_3' ? 3 : 1;
      const { data: prog } = await adminClient.from('progress').select('ghost_tokens').eq('user_id', userId).maybeSingle();
      const current = (prog?.ghost_tokens as number) || 0;
      const { error: grantErr } = await adminClient.from('progress').upsert(
        { user_id: userId, ghost_tokens: current + addCount, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (grantErr) {
        // Release the claim so a retry can grant; don't consume (Play keeps it pending)
        await adminClient.from('play_purchase_ledger').delete().eq('purchase_token', purchaseToken);
        throw new Error(`grant: ${grantErr.message}`);
      }
      // Consume only AFTER the grant landed — an unconsumed purchase is recoverable, a lost grant isn't
      await consume();
    }

    if (isSubscription) {
      // Never overwrite a later expires_at with an earlier one (test subs expire fast)
      let finalExpiresAt = expiresAt;
      if (expiresAt) {
        const { data: existing } = await adminClient
          .from('user_plans')
          .select('expires_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (existing?.expires_at && new Date(existing.expires_at) > new Date(expiresAt)) {
          finalExpiresAt = existing.expires_at;
        }
      }
      await adminClient.from('user_plans').upsert(
        {
          user_id:    userId,
          plan:       dbPlan,
          status:     'active',
          payment_id: purchaseToken,
          email:      null,
          expires_at: finalExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      // Grant 5 ghost tokens on new Plus subscription (top up to 5 if below)
      const { data: prog } = await adminClient.from('progress').select('ghost_tokens').eq('user_id', userId).maybeSingle();
      const current = (prog?.ghost_tokens as number) || 0;
      if (current < 5) {
        await adminClient.from('progress').upsert(
          { user_id: userId, ghost_tokens: 5, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      }
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
