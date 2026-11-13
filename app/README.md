# OpenPath widget — Track 1

> **The main project README is at the repo root** (`../README.md`): what it satisfies, how to run
> it, the privacy claims and how each one is proven. This file covers the app package internals.

React + Vite + TypeScript. Renders any form described by a schema in `../schema/`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run validate   # validates every schema
npm run a11y       # axe-core on all 9 screens + focus/summary/reflow checks  (12 audits)
npm run kb         # dumps the keyboard tab order, for a manual read
```

Live bundle: **60 KB gzipped JS + 2.2 KB CSS**. Fonts: Poppins 15.6 KB + Noto Sans Ethiopic **136 KB** — one variable file, 400–700, covering **all 384 assigned Ethiopic codepoints**.

The Ethiopic face is intentionally *not* subset to our own strings. It was, for one build: `ዘ` (U+12D8) was missing, so a voice transcript rendered as a tofu box — the user's own name as squares. A form accepts text we did not write. `python3 tests/font-coverage.py` fails the build if any assigned Ethiopic codepoint stops rendering.

**Current gate status: 12/12 axe audits clean (zero critical, zero serious), 320 px reflow clean, support answers absent from the submitted payload.**

## Layout

```
src/
├── types.ts        schema types (mirrors ../schema/README.md)
├── i18n.ts         t(text, lang) — falls back to English, never to empty
├── validation.ts   required · phone-et · email · min/max length · min/max value · exclusiveOption
├── useForm.ts      values, errors, navigation, autosave, restore, localOnly filtering
├── fields.tsx      THE FIELD SHELL + all 10 input types
├── screens.tsx     ErrorSummary, ReviewScreen, SettingsBar
├── speech.tsx      ReadAloudButton (speechSynthesis) + VoiceButton (SpeechRecognition)
├── App.tsx         page router, focus management, step renderer
└── schemas/        copied from ../schema/ by `npm run sync:schemas`
```

## The flow (as of 13 Nov)

```
1 language  →  2 support  →  3 name  →  4 phone  →  5 ID route
            →  6 ID value (conditional)  →  7 referral consent (conditional)
            →  8 review  →  9 submit
```

**Language first**, because nobody should read a question in the wrong script. **Support second**, because it changes everything that follows: ticking *bigger text* / *simple words* / *read the questions to me* flips those settings on immediately, and they stay available in the sticky bar at the top for the rest of the form.

> **Rule: support selections can only turn an accommodation ON.** Unticking "bigger text" in the question does not switch it off again — only the user can, in the top bar. Never silently remove help someone asked for.

## What is already true

- **One question per screen**, enforced by the schema shape (a step cannot hold `fields[]`).
- **Focus moves to the `<h1>` on every step change** — the first thing NVDA/TalkBack reads.
- **Failed Continue focuses the error summary**, not the field; summary links jump to the question.
- **Labels, hints and errors** wired with `for` and `aria-describedby` (hint first, then error).
- **48 px minimum** on every control; no fixed heights; survives 200 % zoom and text spacing.
- **No timers anywhere.** Autosave to `localStorage` and a restore banner — never an auto-resume.
- **`localOnly` fields are dropped before submit.** Open the success screen's "What was sent" and the support answers are absent. That is the privacy claim, enforced in one line.
- **Voice never writes a value without a confirm.** `VoiceButton` shows *"We heard: …"* with Accept / Retry / Type instead.
- **Read-aloud cancels on any keypress**, so sound-off is never a fight.
- **Amharic is the default language**, `document.documentElement.lang` switches, `line-height: 1.65`, no italics on Ge'ez.
- **Savanna palette with audited overrides** — navy `#002b56` focus ring; the brand green is never used for text or focus because it measures 1.50:1.
- **`forced-colors` and `prefers-reduced-motion`** handled.
- **Three forms on one engine** (onboarding, job, employer). `schema/templates/example-course-enrolment-v1.json` still exists as the "bring your own schema" example — it is **not** loaded in the app; delete it if you prefer.
- **Savanna theme**: navy `#002b56` band, their `--savanna-aice-*` palette, Poppins. Brand colours are kept wherever they pass and adjusted by the minimum amount where they do not: their red `#db3e3e` stays **verbatim** on error borders, bars and icons (4.40:1, passes the 3:1 non-text rule); only error *text* is darkened to `#cf3636` (4.53:1 on the tint). Muted grey `#98a3ae` (2.57:1) → `#5f6670` (5.80:1).

## What is next, in order

1. **Recorded audio clips** for the 12 fixed questions (tier-0). Right now `speak()` uses the browser voice; on Android with no Amharic TTS it says so honestly. Clips work offline and cost nothing — and they are also the only way read-aloud survives the "sound off" gate for Deaf users who want text, not noise.
2. **`axe-core` in CI** — `npm i -D @axe-core/cli` and run it against the dev server on every screen. The gate requires zero critical/serious.
3. **Script-tag wrapper** (`widget.js` that mounts this app into a `div`) — Level 1 of the adoption criterion.
4. **Docker Compose** — nginx serving `dist/` + a 4-endpoint API for schemas and resume codes.
5. **Error summary `role="alert"` vs focus**: currently both. The co-designer will tell you which double-announces on TalkBack — keep whichever they prefer.

## Do not do

Do not add a field type without adding it to `schema/validate.mjs` first. The validator is the thing that stops the form quietly becoming a 20-question form at 2 a.m.
