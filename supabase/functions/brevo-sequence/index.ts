import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Shared helpers ────────────────────────────────────────────────────────────

const CLASS_CFG: Record<string, { color: string; label: string; trait: string }> = {
  monarch:    { color: '#00F5FF', label: 'MONARCH',    trait: 'Physical dominance. Raw output. No excuses.' },
  mastermind: { color: '#A78BFA', label: 'MASTERMIND', trait: 'Mental sharpness. Deep focus. Systems thinking.' },
  monk:       { color: '#34D399', label: 'MONK',       trait: 'Inner stillness. Ritual discipline. Controlled energy.' },
};

function frame(sub: string, color: string, bodyHtml: string, ctaText: string, ctaColor: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>WEEBJI OS</title></head>
<body style="margin:0;padding:0;background:#09090F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090F"><tr><td align="center" style="padding:48px 16px 64px;">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.18);border-bottom:none;border-radius:16px 16px 0 0;padding:36px 40px 28px;text-align:center;">
    <p style="margin:0 0 8px;font-size:9px;letter-spacing:6px;color:#00F5FF;font-family:'Courier New',monospace;">◈ SYSTEM TRANSMISSION ◈</p>
    <h1 style="margin:0;font-size:24px;font-weight:900;color:#fff;letter-spacing:4px;">WEEBJI OS</h1>
    <p style="margin:8px 0 0;font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:3px;">${sub}</p>
  </td></tr>
  <tr><td style="background:linear-gradient(90deg,transparent,${color},transparent);height:1px;"></td></tr>
  <tr><td style="background:#0D0D22;border-left:1px solid rgba(0,245,255,0.1);border-right:1px solid rgba(0,245,255,0.1);padding:36px 40px;">
    ${bodyHtml}
  </td></tr>
  <tr><td style="background:linear-gradient(90deg,transparent,rgba(0,245,255,0.2),transparent);height:1px;"></td></tr>
  <tr><td style="background:#0D0D22;border:1px solid rgba(0,245,255,0.1);border-top:none;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
    <a href="https://skryrsh.github.io/Weebji-os/" style="display:inline-block;background:${ctaColor};color:#000;font-weight:800;font-size:11px;letter-spacing:3px;text-decoration:none;padding:13px 36px;border-radius:8px;text-transform:uppercase;">${ctaText}</a>
    <p style="margin:20px 0 0;font-size:9px;color:rgba(255,255,255,0.15);letter-spacing:2px;">© WEEBJI OS · The System is always watching</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function quote(text: string, color: string): string {
  return `<div style="background:rgba(0,245,255,0.04);border-left:3px solid ${color};padding:13px 18px;margin:22px 0;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);font-style:italic;line-height:1.7;">&ldquo;${text}&rdquo;</p></div>`;
}

function bullet(glyph: string, text: string, color: string): string {
  return `<p style="margin:0 0 9px;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;"><span style="color:${color};margin-right:8px;">${glyph}</span>${text}</p>`;
}

// ── Email templates ───────────────────────────────────────────────────────────

function emailDay2(name: string, cls: string): { subject: string; html: string } {
  const c = CLASS_CFG[cls] || CLASS_CFG['monarch'];
  const body = `
    <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Courier New',monospace;">SYSTEM CHECK-IN · DAY 2</p>
    <h2 style="margin:0 0 20px;font-size:21px;font-weight:800;color:#fff;">48 hours in, ${name}.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;">The System has been tracking. Two days since registration. Have you logged your first session?</p>
    ${quote('Most people download the app. A few open it. Fewer still begin. The System is waiting to see which one you are.', c.color)}
    <p style="margin:0 0 10px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">Your first workout, focus session, or ritual is all it takes. One logged session starts your streak. The System upgrades your rank from there.</p>
    <div style="border-top:1px solid rgba(255,255,255,0.06);margin:22px 0;"></div>
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;font-family:'Courier New',monospace;">Quick start</p>
    ${bullet('01', 'Open the app → tap your class pillar', c.color)}
    ${bullet('02', 'Log any workout, study session, or ritual', c.color)}
    ${bullet('03', 'Day 1 streak begins. The System takes over from there.', c.color)}`;
  return {
    subject: `◈ Day 2 — The System is waiting, ${name}`,
    html: frame('DAY 2 CHECK-IN', c.color, body, 'Start Your Streak →', c.color),
  };
}

function emailDay7(name: string, cls: string): { subject: string; html: string } {
  const c = CLASS_CFG[cls] || CLASS_CFG['monarch'];
  const body = `
    <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Courier New',monospace;">SYSTEM REPORT · WEEK 1</p>
    <h2 style="margin:0 0 20px;font-size:21px;font-weight:800;color:#fff;">One week registered, ${name}.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;">Seven days since the System accepted you. The first week separates those who try from those who commit.</p>
    ${quote('A 7-day streak is not just a number. It is proof that you can override the part of your brain that wants to quit. Most cannot.', c.color)}
    <div style="border-top:1px solid rgba(255,255,255,0.06);margin:22px 0;"></div>
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;font-family:'Courier New',monospace;">If you have your streak</p>
    <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">Keep it. The System is compounding your rank. A 7-day streak unlocks your first leaderboard milestone.</p>
    <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;font-family:'Courier New',monospace;">If you haven't started yet</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">Today is still Day 1. The System doesn't record excuses — only actions. Log one session right now and begin your actual arc.</p>`;
  return {
    subject: `⚡ Week 1 System Report — Where are you, ${name}?`,
    html: frame('WEEK ONE REPORT', c.color, body, 'Open WEEBJI OS →', c.color),
  };
}

function emailDay21(name: string, cls: string): { subject: string; html: string } {
  const c = CLASS_CFG[cls] || CLASS_CFG['monarch'];
  const body = `
    <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Courier New',monospace;">SYSTEM ALERT · 21 DAYS</p>
    <h2 style="margin:0 0 20px;font-size:21px;font-weight:800;color:#fff;">The System has noticed your absence.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;">Three weeks since registration, ${name}. The System has been running without you.</p>
    ${quote('The gate never closes. But the longer you wait, the more the darkness inside it grows. Every day you delay, someone else is building the streak you could have had.', c.color)}
    <div style="border-top:1px solid rgba(255,255,255,0.06);margin:22px 0;"></div>
    <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">The leaderboard is live. Hunters are ranked. Dungeons are being cleared. Your arc is still blank — but it doesn't have to be.</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.8;">One session. That's all the System asks. Log it today and your rank begins.</p>`;
  return {
    subject: `🔴 21 Days — The System has a message for you, ${name}`,
    html: frame('RECONNECTION REQUIRED', c.color, body, 'Return to the System →', c.color),
  };
}

// ── Edge Function ─────────────────────────────────────────────────────────────

const DAY_OFFSETS: Record<string, number> = { day2: 2, day7: 7, day21: 21 };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Cron-only — no user JWT needed
  if (req.headers.get('x-weebji-cron') !== 'true') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { type } = await req.json();
    const days = DAY_OFFSETS[type as string];
    if (!days) return new Response('Invalid type. Use day2, day7, or day21', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Target date = exactly N days ago (UTC)
    const target = new Date();
    target.setUTCDate(target.getUTCDate() - days);
    const dateStr = target.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // Query users who signed up on target date
    const { data: users, error } = await supabase
      .from('progress')
      .select('user_id, hunter_name, class')
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lt('created_at',  `${dateStr}T23:59:59Z`);

    if (error) throw new Error(error.message);
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('BREVO_API_KEY')!;
    let sent = 0;

    for (const row of users) {
      // Get email from auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
      const email = authUser?.user?.email;
      if (!email) continue;

      const name = row.hunter_name || 'Hunter';
      const cls  = row.class || 'monarch';

      let payload: { subject: string; html: string };
      if (type === 'day2')  payload = emailDay2(name, cls);
      else if (type === 'day7')  payload = emailDay7(name, cls);
      else payload = emailDay21(name, cls);

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: 'WEEBJI OS', email: 'weebjiglobal@gmail.com' },
          to:          [{ email, name }],
          subject:     payload.subject,
          htmlContent: payload.html,
        }),
      });

      if (res.ok) sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, type, date: dateStr }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
