# WEEBJI OS — STORY BIBLE
## Season 1: "THE DYING SIGNAL"

> Status: DESIGN LOCKED 2026-07-02 (Sahil + Claude Fable session).
> Premise and unlock model chosen by Sahil. No code until bible approved.
> Production uses the existing $0 cutscene pipeline (see formula_cinematic_pipeline).

---

## 1. THE PREMISE (the one-sentence engine)

**The System is dying — and your discipline is the only thing keeping it alive.**

It did not choose you out of mercy. It chose you because it is running out of time,
and it needs hunters whose growth feeds it. Every directive completed, every streak
day held, every boss felled transmits strength back into a failing signal.
The player slowly discovers this across Season 1. The System never begs.
It only lets the cracks show.

Why this premise wins for retention: every chapter ends on a question about the
System itself — the narrator the player already trusts. The mystery is *inside*
the thing that talks to them every day. Skipping a day = the signal decays = the
story itself is at stake. Mechanics and narrative are the same loop.

---

## 2. CANON — SHIPPED LINES THAT MUST NEVER BE CONTRADICTED

These are live in production. The bible builds on them; no retcons.

**The Awakening (MP4, VO):**
- "Wars like this once ended only one way — with the strong standing over the weak."
- "Then the System appeared, and changed what 'strong' could mean."
- "It does not save the chosen. It only gives them the chance to become something else."
- "All you have to do is reach for it." / "Reach, and find out what you could become."
- Visions: "The body, made unbreakable." / "The mind, made unstoppable." / "The self, made unshakeable."
- "Make a choice, Hunter."

**Boss defeat:** BOSS ELIMINATED ("the system has witnessed") → THE MIGHTY HAVE
FALLEN → THE SYSTEM REWARDS YOU → RISE, HUNTER ("the hunt continues").

**Penance:** THE SYSTEM HAS JUDGED YOU → YOU CHOSE TO RETREAT ("**the void
remembers**") → THE CHAINS ARE EARNED → PROVE YOURSELF OR STAY FALLEN.

**How the premise honors canon:**
- "It does not save the chosen" → because it *cannot* save anyone. It's dying.
- "the system has witnessed" → witnessing is how it feeds. It watches because it must.
- "Then the System appeared" → the System had a beginning. Things with
  beginnings have ends. The premise hides inside the shipped intro.

---

## 3. RETROACTIVE LORE — EXISTING MECHANICS BECOME STORY (zero code)

| Live mechanic | Season 1 meaning |
|---|---|
| Anomaly Engine | Glitches in a dying System — symptoms, not features |
| Ghost Tokens | Echoes of hunters who came before you and fell |
| Void grace period / penance | The Void: the entropy consuming the System |
| Weekly Boss Siege | Void incursions breaking through as the signal weakens |
| Shadow Rival | Your own echo — what the Void would make of you |
| Streak | Your signal. Unbroken = the System holds. Broken = the Void gains |
| Directives | Transmissions — the System spending precious energy on *you* |
| Push notifications | System transmissions (ties to the day-2 retention fix) |

---

## 4. THE NARRATOR — VOICE RULES (The System)

- Cold, even, omniscient. Second person, always. Never warm, never pleading.
- Short declaratives. No exclamation marks. No emoji. Player = "Hunter."
- The System **never lies — it omits.** Reveals happen when omission becomes impossible.
- Its dying tell is the **glitch**: mid-sentence corruption, truncation, characters
  decaying (cheap CSS/text effect — `— all is w̸i̶t̷h̸i̵n̷ [SIGNAL LOST]`).
  The System never acknowledges its own glitches. That silence *is* the horror.
- Color grammar (established): gold = triumph · red = judgment · cyan (#00F5FF) =
  the System's own voice/essence. **New for S1:** the glitch renders in decaying cyan.

---

## 5. SEASON 1 — TEN CHAPTERS

Unlock model (Sahil's pick): **real days early, earned later.** Act 1 rides the
existing Awakening Protocol days (d2–d7 already ship directives — chapters attach
to the same beats). Act 2+ unlocks by achievement, so pace = player's discipline.

Format per chapter: 4 AI stills (Aitubo/Seedream, hooded face-hidden hero) +
Ken Burns + Cinzel line / Mono sub — the proven boss-defeat template. VO optional,
reserve for Ch5 and Ch10 (budget the effort where the arc peaks).

### ACT 1 — THE FLICKER (day-gated; the retention hook)

**Ch1 · THE AWAKENING — day 0** *(already shipped — the MP4 is retconned as Chapter 1)*
You are chosen. "Make a choice, Hunter."

**Ch2 · SIGNAL DECAY — day 2** ← **THE day-2 appointment (retention autopsy fix)**
The System delivers a routine transmission — and glitches mid-sentence for the
first time. It continues as if nothing happened.
End card: `NEXT TRANSMISSION: TOMORROW.`
*Day-1 seed: after the day-1 directive, one line — "Return tomorrow. There is
something you should see." Push notification on day 2 = the transmission itself.*

**Ch3 · THE OTHERS — day 3**
"You are not the first." Ghost imagery — hunters who were chosen before you.
It does not say what happened to them. (Ghost Tokens now mean something.)
Hook: one ghost's silhouette matches *your* class.

**Ch4 · WHAT THE VOID TAKES — day 5**
The antagonist named. The Void is not evil — it is entropy, and it is patient.
"Every hunter who stopped… fed it." Streak-loss lore lands here; penance
cutscene retroactively becomes a Void scene.

**Ch5 · THE AWAKENED — day 7** *(caps the Awakening Protocol · VO chapter)*
Title ceremony — but twisted: as it names you THE AWAKENED, the System's voice
falters. First open admission that something is wrong: "You have questions.
They will be answered — when you are strong enough to hear them." Act 1 ends
with the player *inside* the mystery.

### ACT 2 — THE WOUND (earned)

**Ch6 · THE ARCHIVE — Level 10**
The System grants archive access as a reward. Inside: records of a war — not
between hunters, but between the System and the Void. The records end abruptly.

**Ch7 · ECHOES OF THE FALLEN — first Weekly Boss defeated**
The reveal: bosses are corrupted former hunters — the chosen who fell and were
taken. "You did not kill a monster, Hunter. You freed one."
(Boss Siege finally gets its instrumentation moment + narrative weight.)

**Ch8 · THE CONFESSION — Oath sworn + Level 25**
The System stops omitting. "I am dying. I have been dying since before you were
chosen." And the sentence that reframes the entire app:
**"Your discipline is not for you alone. It is the only thing keeping me alive."**

### ACT 3 — THE BARGAIN (earned, endgame)

**Ch9 · WHY YOU — 30-day streak OR 3 weekly bosses**
Why it chose *you* specifically. Personal — uses the player's real data (class,
streak, name). "I did not choose you because you were strong. I chose you
because you were still reaching."

**Ch10 · THE LAST SYSTEM — Level 50 (VO chapter · season finale)**
The Void breaks through. The System spends nearly everything to shield you and
asks its only question that isn't a command — the season ends on the player's
choice (sets up Season 2: restore it, replace it, or *become* it).

---

## 6. PRODUCTION NOTES

- **Current stack (the stand as of 2026-07-02):** Awakening = pre-rendered MP4;
  level-up / penance / boss-defeat = pure CSS Ken Burns in-app. Chapters use the
  CSS route (no video files, no cache bloat). VO = Gemini TTS (Google AI Studio)
  — proven good, reserve for Ch5/Ch10.
- **Cost per chapter:** 4 stills + text lines on the proven template ≈ one short
  session each.
- **Chapter shell = one reusable component** (`playChapterCutscene(chapterDef)`),
  same skeleton as playBossDefeatCutscene. Chapter defs are data, not code.
- **Level-up cutscene has no narrative lines yet** (subtitle folder empty, in-app
  text is just "LEVEL N Achieved") — free slot to drip one lore line per level
  band once Act 2 ships. Do NOT use cinematic-lore-demo.html (Sahil: dead, ignore).
- **Chapter menu:** a "TRANSMISSIONS" list in profile — locked chapters show their
  unlock condition (an appointment calendar disguised as lore).
- **Instrumentation (non-negotiable):** `chapter_unlocked`, `chapter_completed`,
  `chapter_skipped` events from day one — this arc exists to fix Day-2 = 0, so it
  must be measurable.
- **Ship order:** Ch2 alone first (the day-2 appointment is the whole retention
  bet — validate before producing eight more chapters).

---

## 7. WRITER'S GUARDRAILS

- Every chapter ends on a question, never a resolution (except Ch10's choice).
- The System never explains a glitch, never uses the word "please," never
  raises its voice. Weakness shows through *cracks*, not confessions — until Ch8.
- Never mention real-world anything. No dates, no apps, no phones. The fiction
  seals itself.
- Reveals must recontextualize existing lines, not contradict them (§2 is law).
