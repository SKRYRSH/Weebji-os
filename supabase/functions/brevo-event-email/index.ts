import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Shared email shell ────────────────────────────────────────────────────────
function shell(headline: string, sub: string, body: string, ctaText: string, ctaColor = '#00F5FF'): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WEEBJI OS</title>
</head>
<body style="margin:0;padding:0;background:#09090F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090F">
<tr><td align="center" style="padding:48px 16px 64px;">
  <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

    <!-- HEADER -->
    <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.18);border-bottom:none;border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
      <p style="margin:0 0 10px;font-size:9px;letter-spacing:6px;color:#00F5FF;font-family:'Courier New',Courier,monospace;text-transform:uppercase;">◈ System Transmission ◈</p>
      <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:4px;text-transform:uppercase;">WEEBJI OS</h1>
      <p style="margin:10px 0 0;font-size:9px;color:rgba(255,255,255,0.22);letter-spacing:3px;text-transform:uppercase;">${sub}</p>
    </td></tr>

    <!-- CYAN RULE -->
    <tr><td style="background:linear-gradient(90deg,transparent 0%,#00F5FF 50%,transparent 100%);height:1px;"></td></tr>

    <!-- BODY -->
    <tr><td style="background:#0D0D22;border-left:1px solid rgba(0,245,255,0.12);border-right:1px solid rgba(0,245,255,0.12);padding:40px 40px 32px;">
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:800;color:#fff;letter-spacing:1px;">${headline}</h2>
      ${body}
    </td></tr>

    <!-- RULE -->
    <tr><td style="background:linear-gradient(90deg,transparent 0%,rgba(0,245,255,0.25) 50%,transparent 100%);height:1px;"></td></tr>

    <!-- CTA FOOTER -->
    <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.12);border-top:none;border-radius:0 0 16px 16px;padding:32px 40px;text-align:center;">
      <a href="https://skryrsh.github.io/Weebji-os/" style="display:inline-block;background:${ctaColor};color:#000000;font-weight:800;font-size:11px;letter-spacing:3px;text-decoration:none;padding:14px 40px;border-radius:8px;text-transform:uppercase;">${ctaText}</a>
      <p style="margin:24px 0 0;font-size:9px;color:rgba(255,255,255,0.18);letter-spacing:2px;text-transform:uppercase;">© WEEBJI OS &nbsp;·&nbsp; The System is always watching</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

function statBlock(label: string, value: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0;">
    <tr>
      <td style="font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.35);text-transform:uppercase;font-family:'Courier New',monospace;padding-bottom:2px;">${label}</td>
      <td style="text-align:right;font-size:13px;font-weight:700;color:#00F5FF;font-family:'Courier New',monospace;">${value}</td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<div style="border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;"></div>`;
}

function systemQuote(text: string): string {
  return `<div style="background:rgba(0,245,255,0.04);border-left:3px solid #00F5FF;padding:14px 18px;margin:24px 0;border-radius:0 8px 8px 0;">
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);font-style:italic;line-height:1.7;">"${text}"</p>
  </div>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

function emailPurchasePlus(name: string, plan: string): { subject: string; html: string } {
  const isAnnual = plan === 'plus_annual';
  const planLabel = isAnnual ? 'ANNUAL PACT' : 'MONTHLY PACT';
  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-family:'Courier New',monospace;">Hunter: ${name}</p>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.8;">Your protocol upgrade is confirmed. The System has registered your commitment and unlocked your full arsenal.</p>
    ${statBlock('Plan', planLabel)}
    ${statBlock('Status', 'ACTIVE')}
    ${statBlock('Access', 'WEEBJI+ ALL FEATURES')}
    ${divider()}
    ${systemQuote('Most hunters train until it hurts. You trained until it\'s who you are. The System has taken note.')}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8;">Your Ghost Tokens, advanced analytics, and unlimited protocol access are now live. The weak version of you ends here.</p>
  `;
  return {
    subject: '◈ WEEBJI+ ACTIVATED — Protocol Upgrade Confirmed',
    html: shell('WEEBJI+ IS LIVE', planLabel, body, 'OPEN WEEBJI OS', '#00F5FF'),
  };
}

function emailPurchaseGhost(name: string): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-family:'Courier New',monospace;">Hunter: ${name}</p>
    <p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.8;">A Ghost Token has been bound to your contract. Use it when life breaks your streak — the System will look away once.</p>
    ${statBlock('Token Type', 'GHOST TOKEN')}
    ${statBlock('Effect', 'STREAK SHIELD ×1')}
    ${statBlock('Expires', 'NEVER')}
    ${divider()}
    ${systemQuote('Even ghosts have a code. You earned the right to one error. Use it wisely.')}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8;">When your streak is at risk, activate your Ghost Token from the dashboard before midnight. The System will register it as an active day.</p>
  `;
  return {
    subject: '👻 Ghost Token Acquired — Your Shield is Ready',
    html: shell('GHOST TOKEN BOUND', 'STREAK PROTECTION ACTIVE', body, 'OPEN WEEBJI OS', '#8B5CF6'),
  };
}

function emailStreak(name: string, streak: number): { subject: string; html: string } {
  const milestones: Record<number, { badge: string; rank: string; quote: string; message: string }> = {
    7:   { badge: '🔥', rank: '7-DAY WARRIOR', quote: 'Seven days. The System has noted your consistency. Do not mistake this for arrival.', message: 'One week without breaking. Most hunters quit by day three. You didn\'t.' },
    30:  { badge: '⚡', rank: 'IRON DISCIPLINE', quote: '30 days. The System has seen what you are. This is not luck. This is identity.', message: 'A full month of unbroken discipline. The System has upgraded your standing among all registered hunters.' },
    100: { badge: '💎', rank: 'TRANSCENDENT', quote: '100 days. You have crossed the threshold where willpower becomes habit. The System cannot explain what you are now.', message: 'Triple digits. You\'ve outlasted 99% of every hunter that ever opened this app. The System doesn\'t hand out 💎 lightly.' },
    365: { badge: '👑', rank: 'LEGEND', quote: 'One full year. 365 unbroken days. The System has searched its records. There is no precedent. You are the precedent.', message: 'One year. Every single day. The System has nothing left to teach you — only to document you.' },
  };
  const m = milestones[streak] || milestones[7];
  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-family:'Courier New',monospace;">Hunter: ${name}</p>
    <div style="text-align:center;padding:24px 0;">
      <div style="font-size:48px;margin-bottom:8px;">${m.badge}</div>
      <div style="font-size:13px;letter-spacing:4px;color:#FFD700;font-family:'Courier New',monospace;font-weight:700;">${m.rank}</div>
    </div>
    ${statBlock('Streak', `${streak} DAYS`)}
    ${statBlock('Rank', m.rank)}
    ${divider()}
    ${systemQuote(m.quote)}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8;">${m.message}</p>
  `;
  return {
    subject: `${m.badge} ${streak}-Day Streak — ${m.rank}`,
    html: shell(`${streak}-DAY STREAK CONFIRMED`, m.rank, body, 'VIEW YOUR PROGRESS', '#FFD700'),
  };
}

function emailLevelMilestone(name: string, level: number): { subject: string; html: string } {
  const thresholds: Record<number, { title: string; quote: string }> = {
    10:  { title: 'INITIATE RANK',     quote: 'Level 10. You\'ve proven you can start. Now prove you won\'t stop.' },
    25:  { title: 'RANKED HUNTER',     quote: 'Level 25. The System promotes you above the majority. This is where real training begins.' },
    50:  { title: 'ELITE RANK',        quote: 'Level 50. Half a century. The System has no words — only a new designation.' },
    100: { title: 'MONARCH RANK',      quote: 'Level 100. Monarch. The System did not think you would get here. It was wrong about you.' },
  };
  const t = thresholds[level] || { title: 'RANK UPGRADE', quote: 'Each level is a version of you that the old you couldn\'t beat.' };
  const body = `
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;font-family:'Courier New',monospace;">Hunter: ${name}</p>
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:13px;letter-spacing:2px;color:rgba(255,255,255,0.4);font-family:'Courier New',monospace;margin-bottom:6px;">LEVEL ACHIEVED</div>
      <div style="font-size:64px;font-weight:900;color:#00F5FF;letter-spacing:-2px;line-height:1;">${level}</div>
      <div style="font-size:11px;letter-spacing:4px;color:#FFD700;margin-top:8px;font-family:'Courier New',monospace;">${t.title}</div>
    </div>
    ${divider()}
    ${systemQuote(t.quote)}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.8;">The System has permanently recorded Level ${level} in your dossier. New thresholds have been unlocked. The System expects more.</p>
  `;
  return {
    subject: `◆ Level ${level} Achieved — ${t.title}`,
    html: shell(`LEVEL ${level} CONFIRMED`, t.title, body, 'CONTINUE TRAINING', '#00F5FF'),
  };
}

// ── Edge Function ─────────────────────────────────────────────────────────────

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

    const { event, data = {} } = await req.json();
    if (!event) return new Response('Missing event', { status: 400 });

    const name = (data.hunter_name as string) || 'Hunter';
    let emailPayload: { subject: string; html: string } | null = null;

    if (event === 'streak_milestone') {
      const streak = Number(data.streak);
      if (![7, 30, 100, 365].includes(streak)) {
        return new Response(JSON.stringify({ ok: false, reason: 'not_a_milestone' }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      emailPayload = emailStreak(name, streak);
    } else if (event === 'level_milestone') {
      const level = Number(data.level);
      if (![10, 25, 50, 100].includes(level)) {
        return new Response(JSON.stringify({ ok: false, reason: 'not_a_milestone' }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      emailPayload = emailLevelMilestone(name, level);
    } else {
      return new Response('Unknown event', { status: 400 });
    }

    const apiKey = Deno.env.get('BREVO_API_KEY')!;
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:   { name: 'WEEBJI OS', email: 'weebjiglobal@gmail.com' },
        to:       [{ email: user.email, name }],
        subject:  emailPayload.subject,
        htmlContent: emailPayload.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Brevo error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
