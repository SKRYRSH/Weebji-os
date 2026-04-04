import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLANS: Record<string, { amount: number; description: string }> = {
  monthly:     { amount: 84900,  description: 'WEEBJI+ Monthly' },  // $9.99 ≈ ₹849
  annual:      { amount: 499900, description: 'WEEBJI+ Annual' },   // $59.99 ≈ ₹4,999
  ghost_token: { amount: 9900,   description: 'Ghost Token' },      // $0.99 ≈ ₹99
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { plan } = await req.json();
    const planConfig = PLANS[plan];
    if (!planConfig) return new Response('Invalid plan', { status: 400 });

    const keyId     = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   planConfig.amount,
        currency: 'INR',
        receipt:  `${plan}_${user.id.slice(0, 8)}_${Date.now()}`,
        notes:    { user_id: user.id, plan, email: user.email },
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      throw new Error(`Razorpay order failed: ${err}`);
    }

    const order = await orderRes.json();

    return new Response(
      JSON.stringify({
        order_id:    order.id,
        amount:      order.amount,
        currency:    order.currency,
        description: planConfig.description,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
