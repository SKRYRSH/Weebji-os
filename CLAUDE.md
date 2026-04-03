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
- Models: Sonnet only — NEVER Opus (drained credits, user banned it)
- Deploy: `git add weebji-os/index.html weebji-os/public/ && git commit && git push` → GitHub Pages

## Security
- Never bypass git hooks (--no-verify)
- Input validation at system boundaries only
