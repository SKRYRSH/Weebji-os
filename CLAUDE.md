# WEEBJI OS — Claude Rules

## Core Rules
- Do exactly what's asked, nothing more
- NEVER create files unless absolutely necessary — prefer editing existing ones
- NEVER create *.md or README files unless explicitly asked
- ALWAYS read a file before editing it (use offset+limit for large files, never full reads)
- NEVER commit secrets, credentials, or .env files
- NEVER hardcode API keys in source files

## Token Efficiency (Critical)
- For index.html: ALWAYS use Grep to find line numbers first, then Read with offset+limit
- NEVER read index.html in full — it's thousands of lines
- Batch all parallel operations in ONE message
- Keep responses short — code only, no preamble

## Project: WEEBJI OS
- Single-file PWA: `weebji-os/index.html` (also copy to `weebji-os/public/index.html`)
- SW: `weebji-os/public/sw.js` — increment CACHE_NAME on every deploy, copy to `weebji-os/sw.js`
- Supabase project: see memory for edge function names and DB schema
- Models: Sahil's call — any model is fine, he picks via /model. Default to Sonnet for routine
  execution (posts, fixes, grinding); bigger models when he chooses them. No model is banned.
- Deploy: `git add weebji-os/index.html weebji-os/public/ && git commit && git push` → GitHub Pages

## Security
- Never bypass git hooks (--no-verify)
- Input validation at system boundaries only
- CLIENT WORK IS PRIVATE: `barbaros/` (and any future client folder) must NEVER be committed
  or pushed — this repo (SKRYRSH/Weebji-os) is PUBLIC. .gitignore enforces this; never remove
  those entries, never `git add -f` client files. New client folder = add it to .gitignore first.

## Session Workflow (start every session here)
1. Read memory MEMORY.md index — recent session files carry open TODOs and root-cause context
2. Small/defined task → /weebji-fix or /weebji-compact. New feature → /weebji-new-feature
3. Before ANY push/deploy → /weebji-deploy-checklist, ship via /weebji-push

## Debugging Standards (how the hard bugs here actually got solved)
- Verify against LIVE data, not code alone: Supabase MCP execute_sql + push_log + PostHog.
  The July 2026 false-notification bug was one wrong row in push_subscriptions — unfindable by reading code.
- Trust nothing that fails silently: this codebase swallows errors (.catch(()=>{}), fire-and-forget
  pushProgress, RLS-denied upserts return no error to UI). When behavior contradicts code, hunt the
  silent drop path first.
- p.* progress fields do NOT auto-persist — new fields need lines in BOTH loadProgress AND saveProgress
- Never .catch() on supabase-js .rpc/.upsert/.update — thenable, no .catch, throws TypeError
- validate-progress rate-limits pushes <5s apart (client retries once after 6s — don't add more)

## Edge Function Rules
- Deployed functions live in Supabase, source mirrors in supabase/functions/ — edit the local file,
  deploy the SAME content via MCP deploy_edge_function, commit both. Never let them drift.
- CHECK verify_jwt before redeploying (list_edge_functions): scheduled-push/send-push/brevo-* are
  false (cron-called), validate-progress/save-push-sub/razorpay-* are true. Wrong value = outage.
- push_subscriptions writes go through save-push-sub edge fn ONLY — direct client upserts can't
  rebind an endpoint across accounts (RLS) and fail silently
- Server-side "trained today" = progress.last_trained_date vs user's local date (timezone from
  push_subscriptions). Any new sync path MUST stamp last_trained_date or false reminders return.

## Tuning Constants (agreed values — don't "improve" without asking)
- Weekly boss: BOSS_HP_MAX 500, DAILY_DMG_CAP 100 (5-day min kill, by design)
- Player HP max is 3 — anything writing p.hp must cap at 3
- Push local hours: morning 9, boss taunt 13, comeback 17, streak reminder + daily complete 20
