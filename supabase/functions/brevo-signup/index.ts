const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

async function sendEmail(apiKey: string, to: string, name: string, subject: string, html: string, scheduledAt?: string) {
  const body: Record<string, unknown> = {
    sender:      { name: 'WEEBJI OS', email: 'weebjiglobal@gmail.com' },
    to:          [{ email: to, name }],
    subject,
    htmlContent: html,
  };
  if (scheduledAt) body.scheduledAt = scheduledAt;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ── Email templates ───────────────────────────────────────────────────────────

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
    <a href="https://weebji.com" style="display:inline-block;background:${ctaColor};color:#000;font-weight:800;font-size:11px;letter-spacing:3px;text-decoration:none;padding:13px 36px;border-radius:8px;text-transform:uppercase;">${ctaText}</a>
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

// Email 1 — Welcome (immediate)
function emailWelcome(name: string, cls: string): { subject: string; html: string } {
  const c = CLASS_CFG[cls] || CLASS_CFG['monarch'];
  const body = `
    <p style="margin:0 0 5px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Courier New',monospace;">NEW HUNTER REGISTERED</p>
    <h2 style="margin:0 0 20px;font-size:21px;font-weight:800;color:#fff;">Welcome, ${name}.</h2>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.8;">The System has accepted your registration. Your class has been assigned. Your protocol begins now.</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;"><tr><td style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.07);border-left:3px solid ${c.color};border-radius:0 8px 8px 0;padding:14px 18px;">
      <p style="margin:0 0 3px;font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Courier New',monospace;">CLASS ASSIGNED</p>
      <p style="margin:0 0 5px;font-size:16px;font-weight:700;color:${c.color};letter-spacing:2px;font-family:'Courier New',monospace;">${c.label}</p>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">${c.trait}</p>
    </td></tr></table>
    <div style="border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;"></div>
    <p style="margin:0 0 12px;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;font-family:'Courier New',monospace;">The System has prepared</p>
    ${bullet('◆', 'Daily training protocol — workouts, focus sessions, rituals', c.color)}
    ${bullet('◆', 'Dungeon Gates — 10 boss challenges unlocked by consistent training', c.color)}
    ${bullet('◆', 'Global leaderboard — compete against every registered hunter', c.color)}
    ${bullet('◆', 'Arc share card — document and share your evolution', c.color)}
    ${quote('The System does not care about your past. Only what you do next. Begin.', c.color)}`;
  return {
    subject: '◈ Hunter Registration Confirmed — Your Arc Begins',
    html: frame('HUNTER REGISTRATION CONFIRMED', c.color, body, 'Begin Your Arc →', c.color),
  };
}

// Email 2 — Day 2 check-in
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

// Email 3 — Day 7 first week
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

// Email 4 — Day 21 re-engagement
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { email, hunter_name, class: hunterClass, signup_date } = await req.json();
    if (!email) return new Response('Missing email', { status: 400 });

    const apiKey = Deno.env.get('BREVO_API_KEY')!;
    const name   = hunter_name || 'Hunter';
    const cls    = hunterClass || 'monarch';

    // 1. Add / update contact in Brevo list
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: name, CLASS: cls, SIGNUP_DATE: signup_date || new Date().toISOString() },
        listIds: [3],
        updateEnabled: true,
      }),
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.text();
      throw new Error(`Brevo contact error: ${err}`);
    }

    // 2. On first signup: send full sequence — no automations needed
    if (contactRes.status === 201) {
      const w  = emailWelcome(name, cls);
      const d2 = emailDay2(name, cls);
      const d7 = emailDay7(name, cls);
      const d21 = emailDay21(name, cls);

      await Promise.allSettled([
        sendEmail(apiKey, email, name, w.subject,   w.html),                    // immediate
        sendEmail(apiKey, email, name, d2.subject,  d2.html,  isoInDays(2)),    // +2 days
        sendEmail(apiKey, email, name, d7.subject,  d7.html,  isoInDays(7)),    // +7 days
        sendEmail(apiKey, email, name, d21.subject, d21.html, isoInDays(21)),   // +21 days
      ]);
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
