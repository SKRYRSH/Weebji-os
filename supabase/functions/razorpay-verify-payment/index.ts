import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildPurchaseEmail(email: string, planLabel: string): string {
  const isGhost   = planLabel === 'ghost_token';
  const accentClr = isGhost ? '#8B5CF6' : '#00F5FF';
  const badge     = isGhost ? '👻' : '◈';
  const title     = isGhost ? 'GHOST TOKEN BOUND'        : 'WEEBJI+ IS LIVE';
  const subtitle  = isGhost ? 'STREAK PROTECTION ACTIVE' : (planLabel === 'plus_annual' ? 'ANNUAL PACT SEALED' : 'MONTHLY PACT SEALED');
  const bodyLines = isGhost
    ? [`A Ghost Token has been bound to your contract.`,
       `Use it when life breaks your streak — the System will look away once.`,
       `Activate it from your dashboard <strong style="color:#8B5CF6;">before midnight</strong> on any day you couldn\'t train.`]
    : [`Your WEEBJI+ upgrade is confirmed.`,
       `Ghost Tokens, advanced analytics, and your full protocol arsenal are now active.`,
       `The weak version of you ends here.`];

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>WEEBJI OS</title></head>
<body style="margin:0;padding:0;background:#09090F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090F">
<tr><td align="center" style="padding:48px 16px 64px;">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
    <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.18);border-bottom:none;border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
      <p style="margin:0 0 10px;font-size:9px;letter-spacing:6px;color:#00F5FF;font-family:'Courier New',monospace;">◈ SYSTEM TRANSMISSION ◈</p>
      <h1 style="margin:0;font-size:26px;font-weight:900;color:#fff;letter-spacing:4px;">WEEBJI OS</h1>
      <p style="margin:10px 0 0;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:3px;">${subtitle}</p>
    </td></tr>
    <tr><td style="background:linear-gradient(90deg,transparent,${accentClr},transparent);height:1px;"></td></tr>
    <tr><td style="background:#0D0D22;border-left:1px solid rgba(0,245,255,0.12);border-right:1px solid rgba(0,245,255,0.12);padding:40px;">
      <p style="margin:0 0 6px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.35);font-family:'Courier New',monospace;">HUNTER EMAIL: ${email}</p>
      <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#fff;">${badge} ${title}</h2>
      ${bodyLines.map(l => `<p style="margin:0 0 12px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;">${l}</p>`).join('')}
      <div style="border-top:1px solid rgba(255,255,255,0.06);margin:28px 0;"></div>
      <div style="background:rgba(0,245,255,0.04);border-left:3px solid ${accentClr};padding:14px 18px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);font-style:italic;line-height:1.7;">${isGhost ? '"Even ghosts have a code. You earned the right to one error. Use it wisely."' : '"Most hunters train until it hurts. You trained until it\'s who you are. The System has taken note."'}</p>
      </div>
    </td></tr>
    <tr><td style="background:linear-gradient(90deg,transparent,rgba(0,245,255,0.2),transparent);height:1px;"></td></tr>
    <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.12);border-top:none;border-radius:0 0 16px 16px;padding:32px 40px;text-align:center;">
      <a href="https://skryrsh.github.io/Weebji-os/" style="display:inline-block;background:${accentClr};color:#000;font-weight:800;font-size:11px;letter-spacing:3px;text-decoration:none;padding:14px 40px;border-radius:8px;text-transform:uppercase;">OPEN WEEBJI OS</a>
      <p style="margin:24px 0 0;font-size:9px;color:rgba(255,255,255,0.18);letter-spacing:2px;">© WEEBJI OS · The System is always watching</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

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

    // ghost_token: never touch user_plans (would overwrite an existing plus subscription)
    if (plan !== 'ghost_token') {
      const { error: insertErr } = await serviceClient.from('user_plans').upsert({
        user_id:    user.id,
        email:      user.email,
        plan:       planLabel,
        status:     'active',
        order_id:   razorpay_order_id,
        payment_id: razorpay_payment_id,
      }, { onConflict: 'user_id' });
      if (insertErr) throw insertErr;
    }

    // ghost_token: just increment tokens in progress
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

    // Send thank-you email via Brevo (fire-and-forget — don't fail payment on email error)
    try {
      const emailHtml = buildPurchaseEmail(user.email || 'Hunter', planLabel);
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': Deno.env.get('BREVO_API_KEY')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender:      { name: 'WEEBJI OS', email: 'weebjiglobal@gmail.com' },
          to:          [{ email: user.email }],
          subject:     plan === 'ghost_token'
            ? '👻 Ghost Token Acquired — Your Shield is Ready'
            : '◈ WEEBJI+ ACTIVATED — Protocol Upgrade Confirmed',
          htmlContent: emailHtml,
        }),
      });
    } catch (_) { /* email failure must never block payment confirmation */ }

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
