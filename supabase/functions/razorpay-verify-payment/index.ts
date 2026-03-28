import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${orderId}|${paymentId}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return new Response('Missing fields', { status: 400 });
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const valid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret);
    if (!valid) return new Response('Invalid signature', { status: 400 });

    // Use service role to bypass RLS for writing payment record
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const planLabel = plan === 'annual' ? 'plus_annual' : plan === 'ghost_token' ? 'ghost_token' : 'plus';

    const { error: insertErr } = await serviceClient.from('user_plans').insert({
      user_id:    user.id,
      email:      user.email,
      plan:       planLabel,
      status:     'active',
      order_id:   razorpay_order_id,
      payment_id: razorpay_payment_id,
    });

    // If ghost_token, increment ghost_tokens in progress
    if (plan === 'ghost_token') {
      const { data: prog } = await serviceClient
        .from('progress')
        .select('ghost_tokens')
        .eq('user_id', user.id)
        .single();
      const current = prog?.ghost_tokens ?? 0;
      await serviceClient
        .from('progress')
        .update({ ghost_tokens: Math.min(current + 1, 60) })
        .eq('user_id', user.id);
    }

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
