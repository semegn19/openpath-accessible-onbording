# HANDOFF — OpenPath (Digital Bridge Accessibility Hackathon 2026, Track 1)

**Written:** 13 Nov 2026, at commit `36ed2dd`.
**Audience:** a coding agent picking this up cold, with no memory of the sessions that produced it.
**Rule for this document:** everything here was measured or read, not remembered. Where I could not verify something, it says so.

---

## 0. The sixty-second version

- **What it is:** a drop-in, schema-driven sign-up widget with three forms — learner onboarding (`/onboard`), job application (`/job`), employer accommodations (`/employer`) — for the ALX **Digital Bridge Accessibility Hackathon 2026**, Track 1. Amharic-first, voice-capable, offline-tolerant, WCAG 2.2 AA.
- **State:** tree clean, `HEAD = 36ed2dd`. Full gate `cd app && npm run check` → **EXIT=0, 257 assertions, 0 failures** (~2 minutes).
- **Verify before you change anything.** If the gate is not green on the tree you were handed, stop and report that before touching code.
- **Biggest open risk:** the judges' gate starts with *"a co-designer completes the main task unaided with NVDA, TalkBack, keyboard only, 200 % zoom and sound off"*. No screen reader has ever been run against this build. That is the one thing no script closes.
- **Do not** start the hook-extraction refactor (Wave 2b–2e) without explicit approval — see §8.1. It is high risk, low reward before judging day.
- **Read next, in this order:** §1 (what we're building), §3 (how to run), §9 (the user's standing rules), §10 (landmines). §10 is the part that saves you the most time.

---

## 1. What we are building, and what "done" means

### The event

- **Digital Bridge Accessibility Hackathon 2026**, an ALX Ethiopia programme (with SNV, Mercy Corps/LIWAY, AAAPD, Tomorrow is Better). Site: <https://digitalbridge.et/>. 14–15 Nov 2026, ALX Tech Hub Lideta, Addis Ababa.
- **Track 1 — Accessible onboarding.** "You build a drop-in sign-up and profile component." Learners who are blind, have a physical disability, read with difficulty, or have no standard ID. Must also ship a **career gateway**: job application flow, a private "support I need" filter, and an employer accommodations form. All three exist here.
- Deadline: **Sunday 15 Nov, 16:30** — submit code, README, Docker Compose, and a WCAG 2.2 AA conformance report.

### The gate, verbatim from the organisers' site

> **First, the gate. Pass or fail.**
> A co-designer completes the main task unaided with NVDA, TalkBack, keyboard only, 200 per cent zoom and sound off. axe-core shows zero critical or serious issues. The team submits a WCAG 2.2 AA conformance report.

Three pass/fail conditions. Note that this is *not* the same as the nine-point checklist that circulates among teams; §7 has the status of both.

### Scoring (for context on what to prioritise)

30 works for the people it's for · 25 can be adopted (a judge installs it in an hour from your docs) · 15 built for Ethiopia (Amharic, Ethiopic script and calendar, cheap Android on 3G, offline) · 15 quality, security and privacy · 15 can be kept running. Read: a judge must be able to install and run this from the README alone.

---

## 2. Exact state of the repo

```
HEAD            36ed2dd  docs(a11y): correct two overstatements in the conformance report
                23c4564  fix(a11y): mark the English option with lang="en" (SC 3.1.2)
                7aa1f3e  wave 2a: form-agnostic test primitives, and an honest correction to the plan
                a608f2e  wave 1f: the last string, and what wave 1 deliberately left out
                d0f7ca7  wave 1e: microphone, listening and privacy copy move to runtime-copy
                488290f  wave 1d: announcements, connectivity and banners move to runtime-copy
                6654da1  wave 1c: settings bar, date field and file notice move to runtime-copy
                6e7be9a  wave 1b: send status and receipt copy moves to runtime-copy
                7226cd8  wave 1a: a home for the copy the app prints about itself
                03cf756  wave 0: one source of truth for schemas, and a .gitignore that means it
```

Working tree clean. Node **20.20.2**, npm **10.8.2**, Playwright **1.65**, Vite 5.4, React 18, TypeScript 5.6.

| Path | Size | What it is |
|---|---|---|
| `app/` | 237 K src | The widget: Vite + React + TS. `app/src` is 2,221 lines across 17 files. |
| `schema/` | 116 K | The source of truth for all three forms + runtime copy. 4 JSON files, validated. |
| `api/` | 100 K | One Node file (`server.mjs`, 496 lines) + `openapi.yaml` (350 lines). No DB. |
| `docs/` | 236 K | 14 markdown files. Index in §17. |
| `.git/` | **392 MB** | Bloated by old binary history. See §8.2 — do not try to fix this before the deadline. |
| `shots/` | 46 files | Reference screenshots, used by `tests/shots.mjs`. |
| `phases/`, `openpath-build-plan.md` | — | The **post-win** horizon (26-week plan). Explicitly "do not open before Sunday". |
| `hackathon-2day.md` | — | The weekend build sheet. This is the plan that matters. |
| `uploads/other_agent_work.md` | 650 lines | Idea dump the user accepted ("ideas i accept"). Useful for intent, not authority. |
| `pdf_text.txt` | — | Extracted text of an earlier research/architecture report. Background only. |

**Not in the snapshot:** `app/node_modules` (92 MB) and `~/.cache/ms-playwright` (699 MB) are excluded from workspace snapshots. See §3 for first-time setup.

---

## 3. How to run it (read this before your first command)

```bash
cd app
npm install                      # node_modules is NOT in the snapshot
npx playwright install chromium  # browsers are NOT in the snapshot
npm run dev                      # vite on 0.0.0.0:5173 — LEAVE THIS RUNNING
```

Then, in a second shell:

```bash
cd app && npm run check          # the whole gate: ~2 min, EXIT=0, 257 assertions
```

### The trap that will cost you an hour

**`npm run check` does not start a web server.** Eleven test files fetch `http://127.0.0.1:5173` and nothing spawns Vite for them (`precheck` only runs `sync:schemas`). If no dev server is running, those tests fail confusingly. Worse: **if port 5173 is already taken, Vite silently starts on 5174** and every test then hammers whatever stale build is still on 5173. Always confirm:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/onboard   # expect 200
```

Other entry points: `npm run api:dev` (API on its own), `docker compose up -d --build` → <http://localhost:8080/onboard> (nginx + API, the judge's path; `npm run verify:prod` tests it locally).

---

## 4. Architecture tour

One engine, three schemas. `App.tsx` picks a schema by URL slug; everything else is generic.

| File | Lines | Role | Safe to touch? |
|---|---|---|---|
| `src/App.tsx` | **531** | The shell: state, effects, announcement logic, JSX. `PAGES` array at the top maps slug → schema. | Careful — see §8.1. Layout: wrapper+slug 1–33 · hooks/state 35–67 · effects 39–243 (39 %) · `handleChange` 244–274 · JSX 275–531 (**256 lines, 48 %**). |
| `src/fields.tsx` | 297 | Renders every step type: text, tel, email, number, textarea, select, radio, checkbox, file, date-ec-gc, statement, review. Fieldset grouping, hints, errors, `aria-describedby`. Option label carries `lang` (see §7.4). | Yes — this is the a11y/rendering lane. |
| `src/speech.tsx` | 379 | `ReadAloudButton`, `VoiceField`, ASR plumbing, device TTS, consent. Never writes an uncertain transcript into the form. | Yes, with care. |
| `src/useForm.ts` | 191 | Form state, validation, draft autosave (debounced), cancel-speech-on-key. | Yes. |
| `src/screens.tsx` | 113 | Settings bar (language, bigger text, simple words, auto-read), error summary (`role="alert"`, `tabIndex={-1}`), review screen. | Yes. |
| `src/digits.ts` | 110 | Amharic/Ethiopic digit handling (`፩` vs `1`), phone normalisation. | Yes — pure functions, well tested. |
| `src/api.ts` | 105 | `submit()` with 10 s abort, error classification (`offline`/`timeout`/`no-api`/`server`). | Yes. |
| `src/outbox.ts` | 97 | Offline queue. Keeps answers, idempotency ref, retries on reconnect. | Yes. |
| `src/audio.ts` | 79 | Recorded prompt playback (cached clips), `stopAudio`. | Yes. |
| `src/types.ts` | 76 | `Schema`, `Step`, `Option`, `LText`. The data contract. | Yes — additive changes only. |
| `src/validation.ts` | 75 | Rules: required, length, phone pattern, ID patterns, exclusive option. | Yes. |
| `src/icons.tsx` | 61 | Inline SVG. **Both svgs are `aria-hidden="true" focusable="false"`** — decorative, no alt text needed. | Yes. |
| `src/router.ts` | 45 | `useSlug`, routes `/onboard`, `/job`, `/employer`. Unknown slug **falls back silently to onboard**. | Yes. |
| `src/copy.ts` | 23 | Accessor `c(key, lang)` over the runtime-copy schema. | Rarely. |
| `src/i18n.ts` | 18 | `t()`/`tpl()` message builders — the reason a `{placeholder}` can never reach the screen. | Rarely. |
| `src/main.tsx` | 20 | Mount + service worker registration. | No. |

*(The 17th file is a one-line `vite-env.d.ts`.)*

**Adding a fourth form** = one JSON file in `schema/` + one line in `PAGES`. **Adding a step type** = `types.ts` union + a branch in `fields.tsx` + a check in `schema/validate.mjs` (`STEP_TYPES`).

---

## 5. Data model and the copy system

- **`schema/savanna-onboard-v1.json`** — 640 lines, 10 steps: language, accessibility-prefs, assistance, name, phone, id-route, id-value, referral, review, submit.
- **`schema/savanna-job-v1.json`** — 671 lines, 11 steps.
- **`schema/employer-accommodations-v1.json`** — 573 lines, 9 steps.
- **`schema/runtime-copy-v1.json`** — 300 lines, **73 keys**: every string the app prints *about itself* (announcements, banners, settings labels), as opposed to form content. `app/src/copy.ts` reads it.

**Flow of truth:** `schema/*.json` → `npm run sync:schemas` → `app/src/schemas/*.json` → imported by `App.tsx`.

`app/src/schemas/` is **generated and gitignored**. After editing anything in `schema/`, run `npm run sync:schemas` (or start `npm run dev`, which does it as `predev`). If you skip it, the app serves stale JSON and you will debug a fix that never applied.

**Validation** (`npm run validate`, part of the gate): unknown step types, missing languages, mismatched `{placeholders}`, `showIf` pointing at a non-existent option, a `select` carrying icons, preferences that apply nothing, duplicate sentences. Currently **0 errors, 0 warnings**. Treat a new warning as a defect.

**Copy budget:** `tests/copy-source.mjs` enforces `CEILING = 37` for strings still hardcoded in TSX rather than the runtime-copy schema. Wave 1 drove the count down; do not raise the ceiling.

---

## 6. The test suite — what each script actually proves

`npm run check` chains 17 scripts. **257 assertions.** Everything below is run by the gate unless marked.

| Script | Proves |
|---|---|
| `tests/a11y.spec.mjs` | 17 axe audits (`wcag2a wcag2aa wcag21a wcag21aa wcag22aa`). **Only audits the screen each URL lands on** — it never walks the form. |
| `tests/pages.mjs` | Three pages render, routes work, no third-party hosts. |
| `tests/api.mjs` | API contract: submit, idempotency, rate limit, PII stripping. |
| `tests/submit.mjs` | End-to-end submit through the UI. |
| `tests/voice.mjs` | Voice field behaviour, transcript acceptance — 32 assertions. Uses `_flow.mjs`. |
| `tests/errors.mjs` | Validation messages, error summary, `aria-invalid`. |
| `tests/parity.mjs` | The three schemas stay structurally aligned (reads `schema/`). |
| `tests/copy-source.mjs` | Hardcoded-string ceiling (`CEILING = 37`). |
| `tests/transcribe.mjs` | ASR endpoint behaviour, uncertain transcripts never auto-accepted. |
| `tests/focus-obscured.mjs` | 2.4.11: 14 tab stops at 390×400 vs the sticky settings bar. |
| `tests/no-third-party.mjs` | No outbound requests — everything is self-hosted. |
| `tests/audio.mjs` | Audio manifest ↔ schema keys (`audio:check`). |
| `tests/controls.mjs` | Control behaviour, guards against `.check()` on an already-checked input. |
| `tests/simple.mjs` | Low-literacy ("simple words") path; `--strict` variant available. |
| `tests/offline.mjs` | Service worker, draft survival offline, outbox, reconnect, idempotent retry. |
| `tests/announce.mjs` | Live-region output. **Prints 4 lines and asserts nothing** — compare its output byte-for-byte when refactoring announcements. |
| `tests/kb.mjs` | **Prints the tab order; asserts nothing.** Not evidence of keyboard operability on its own. |
| `tests/shots.mjs`, `shot-success.mjs` | Screenshots into `shots/`. Not in the gate. |
| `tests/csp.mjs`, `nginx-sim.mjs` | Production CSP and nginx semantics via `verify:prod`. Not in the gate. |

**`app/tests/_flow.mjs`** — the shared walkers, added in `7aa1f3e`. Exports: `LABELS`, `goto`, `next`, `answer`, `submitFromReview`, `stepNo`, `walkTo`, `fillVisible`, `setLang`, `setPrefs`. They navigate, they never assert. Use them for every new probe instead of growing another hand-rolled walker.

---

## 7. Accessibility: where it stands

Three documents carry the evidence. Read them before re-measuring anything:

| Document | What's in it |
|---|---|
| `docs/wcag-2.2-aa-conformance.md` (202 lines) | The gate deliverable. **55 criteria in scope, 55 supported, 6 of them vacuously (5 × 1.2.x + 3.2.6), 0 failures.** Explicitly withholds a *conformance* claim until co-designer sessions are done (§7 of that file). |
| `docs/wcag-2.2-aa-audit-2026-11-13.md` (54 lines) | The 16 criteria the user named, each with a measurement: **14 satisfied, 2 N/A (3.2.6, 3.3.8), 0 failed.** |
| `docs/judging-day-check-2026-11-13.md` (107 lines) | Seven common bug patterns, the nine-point self-check, and the organisers' published gate with status. |

### 7.1 Hard numbers (all measured in Chromium, this repo)

- **Coverage:** 29 screens end-to-end (9 `/onboard` + 11 `/job` + 9 `/employer`), **192 interactive targets**.
- **axe:** 17 landing-screen audits **+ 26 deep screens** (8/10/8) = 43 screens, **0 violations of any impact**.
- **2.5.8 Target size:** raw `<input type=radio|checkbox>` is **23.2 × 23.2 px** (`width: 1.45rem`, `styles.css:174`) — just under 24. The effective target is the wrapping `<label>`: **334 × 52 px**, proven by a real mouse click **278 px to the right of the input box** toggling the control. All buttons/links/inputs ≥ 24 px.
- **2.4.7 Focus visible:** 57 keyboard stops, **0 without an outline or box-shadow** (counting `:focus-within` ancestor rings). `--op-focus #002b56`, 3 px.
- **2.1.1 Keyboard:** 0 controls outside the tab order (`tabindex<0`/disabled: none); 7 radio/checkbox toggles driven by Space, 0 failures.
- **1.4.3 Contrast:** body `#212529` 15.43:1 (white) / 12.68:1 (tint); muted `#5f6670` 5.80 / 4.77; primary `#002b56` 14.19; accent `#5648b7` 6.99; error text `#cf3636` **4.96 on white**, **4.53 on the error surface `#fdf2f2`**; borders 5.80; focus ring 14.19.
- **1.4.10 Reflow at 400 %:** 320 CSS px width, **0 horizontal overflow**: 12/12, 12/12, 11/11 screens.
- **2.4.11 Focus not obscured:** `elementFromPoint` at 5 points × 16 tab stops × 3 forms × 2 viewports. Only hit is the skip link's bottom-right point under `header.op-band` — inside its **rounded corner**, where its own background does not paint. AA met; **not** a 2.4.12 (AAA) claim.
- **3.1.2 Language of parts:** fixed at `23c4564`. Before: the Amharic form rendered `<span class="op-option-label">English</span>` inheriting `lang="am"`, so a screen reader read the English word with an Amharic voice. Now **0** unmarked other-script text runs.

### 7.2 Two claims already corrected (do not re-raise them as new findings)

- **3.1.2** previously said *"no string mixes languages"*. That was false; the row now documents the defect and the fix (`23c4564`).
- **3.2.6 Consistent Help** previously claimed *"the same relative order on all three forms and every step"*. It is not: the support request is a form step at position 3 of 10 in `/onboard`, 9 of 11 in `/job`, and absent from `/employer`. Read-aloud is a presentation control, not help. Verdict is now **N/A** — a withdrawn claim, not a failure. Totals moved accordingly.

### 7.3 Known fragility (real, not yet a failure)

- `#cf3636` on `--op-primary-tint #eaf0f6` computes **4.32:1 — below AA**. No error text is painted there today (every `.op-error*` element resolves to white or `#fdf2f2`), so it is latent. It becomes a real failure the day an error is rendered inside a tinted panel.
- Error text on the error surface passes by 0.03 (4.53 vs 4.50). Any nudge to that red must be re-measured.
- `.op-option-label` `lang` is schema-driven (`Option.lang`). A new option whose label is in another language needs the same key or it inherits the page language.

### 7.4 What has never been done

**No screen reader has touched this build.** No NVDA, no TalkBack, no VoiceOver. Also: Chromium only (no Firefox/Safari), no real Android WebView, no `prefers-contrast`/forced-colors rendering check. The live-region design — one region, five announcement sources, a 15 s save throttle, never-announce-the-first-save — is precisely the kind of thing only a real screen reader validates.

If you get a co-designer or a screen reader, in this order: (1) complete `/onboard` unaided with sound off, (2) submit with a validation error to hear the error summary, (3) change language mid-form, (4) go offline mid-form and submit, (5) turn on "bigger text" and repeat step 1.

---

## 8. What is not done

### 8.1 Hook extraction from `App.tsx` (Wave 2b–2e) — **NOT APPROVED, DO NOT START**

The plan exists, in dependency order: 2b `useAnnounce` → 2c `useConnectivity` → 2d `useSend` (highest risk) → 2e `useAppliedSettings`. One commit each, individually revertible. Acceptance: `App.tsx` ≤ 340 lines, gate 257 with an **identical** ✓ list, and identical `announce.mjs` output.

**Why it is risky in plain terms.** Announcement behaviour rests on four refs that survive only as long as one component instance and one hook order:

| ref | what it enforces |
|---|---|
| `savedSpokenAt` | the 15 s throttle — once per 15 s, not per keystroke |
| `firstSave` | never announce the first save |
| `prevCount` | "a question was added" fires exactly once |
| `lastStepId` | focus the `h1` on step change, never on first load |

All five announcement sources write to **one** live region. Split hooks must share a single `setAnnounce`. The failure mode builds clean and is visible only in *when* the region speaks — i.e. only to a screen-reader user.

**My recommendation stands:** do 2b and 2d only if you have spare hours and a screen reader to check them; skip 2c/2e before a deadline; **do not touch the 256-line JSX**. Wave 2a (the test primitives) was the cheap, safe half and is done.

### 8.2 `.git` is 392 MB

History bloat from old binaries. `git-filter-repo` is not installed here. Rewriting history is not approved and is a bad idea 48 hours before submission. **Recommended instead:** submit from a **shallow clone** (`git clone --depth 1`), or export a clean tree. Do not run `git gc --aggressive` hoping; `git rm --cached` does not shrink `.git`.

### 8.3 Small, safe hardening (each ≤ 1 line, all optional)

1. `styles.css:174` `1.45rem` → `1.5rem` makes the raw radio/checkbox exactly 24 px and removes the 2.5.8 argument entirely.
2. `api/openapi.yaml` — add one paragraph to `info.description` describing keyboard and ARIA support. The README does this well; the spec has only incidental matches, and "API docs describe keyboard and ARIA support" is on the circulating self-check list.
3. If AAA 2.4.12 is ever wanted: `.op-skip` needs square corners or a higher stacking context than `.op-band`.
4. Backlog **W13**: runtime copy stays **out** of the audio manifest. Do not add runtime strings to `scripts/_strings.mjs`.

---

## 9. Standing instructions from the user

These are the user's explicit directions, not my inferences. Violating them has cost the work real time before.

1. **Work wave by wave: plan first, ask, then execute, then report.** The user expects a written plan for anything risky, and expects claims backed by measurement.
2. **Do not answer with a menu of dense options.** A two-question, multi-option `ask_user` was rejected as unintelligible. Explain *what* is risky, *why*, and *how much is touched*, in plain words, with a concrete bounded list.
3. **Prefer doing the safe half and reporting it** over asking for commitment to risky work first.
4. **Measure before asserting a defect.** An accusation that the employer voice test ran in Amharic was wrong and had to be withdrawn after a probe (the settings bar has a real "English" button). A probe is cheap; a retracted claim is expensive.
5. **Self-verify loudly.** State the command, the number, and the diff — e.g. "257 ✓ / 0 ✗, announce output byte-identical".
6. **Do not reintroduce the shorter `/employer` labels** `"Read the question"` / `"Speak your answer"`. All three forms use the long form.
7. **`/employer` round-4 simple-text fixes stand**: `job-category.hint.am` → `አንዱን ይምረጡ።`; `accommodations.simpleWhy`; `contact.simpleWhy`. The `accommodations` simple-English line stays the rewritten version, not the reviewer's.
8. **Runtime copy stays out of the audio manifest** (backlog W13). Do not add runtime strings to `scripts/_strings.mjs`.
9. **Copy lane, a11y lane, plumbing lane and tests lane are separate.** Copy changes touch `schema/*.json` only; rendering touches `fields.tsx` + `styles.css`; plumbing touches `outbox.ts`/`api.ts`; tests touch `_flow.mjs` plus one file each.
10. **Design rule:** `type` describes the *answer*, not the widget. Reserve `select` for lists too long to show as cards. Options carrying icons must be `radio`.

---

## 10. Landmines, dead ends and traps

Grouped by where you will hit them. Almost all of these cost a debugging cycle already.

### Measurement and testing

- **A bounding box `top < barBottom` is not an obscuration test.** It flags anything starting at `y = 0`, including a fully visible skip link. Use `elementFromPoint` at several points of the focused element.
- **axe only audits the screen a URL lands on.** The shipped suite has never walked the form. Any claim about deep screens is yours to measure.
- **`tests/kb.mjs` and `tests/announce.mjs` assert nothing** — they print. Never cite them as evidence on their own; diff their output before and after a change.
- **Label-matching assertions can be vacuous.** A test that matches a label which does not exist passes trivially. Assert counts, not absence of errors.
- **Don't match Amharic with a JS regex** — for script detection use the range `/[\u1200-\u137F]/` on text nodes, as the lang scanner does.
- **Don't combine Playwright `:has-text` selectors.**
- **`getByRole('button', { name: /^English$/ })` matches the settings-bar chip**, not a form option. Probe `count()` before trusting a selector.
- **`/about-you` is not a route.** Unknown slugs fall back to `/onboard` silently — a probe that "measured three forms" may have measured onboard twice. The routes are `/onboard`, `/job`, `/employer`.
- **Walkers must fill before advancing.** `fillVisible()` then `next()`, repeated, or you stall on the first text step. `walkTo(page, n)` uses `.op-progress` to know where it is.
- **On the language screen the radios *are* the languages.** Clicking "the first unchecked radio" changes the language instead of answering. Use `setLang()`.
- **`.check()` stalls 30 s on an already-checked input.** Guard with `input[type=radio]:checked` first (as `controls.mjs` does).
- **Preference boxes are checkboxes, found by index**, not radios.
- **Probe scripts must live inside `app/tests/`** to resolve `playwright` (`/tmp/x.mjs` fails with `ERR_MODULE_NOT_FOUND`). Name them `_tmp_*.mjs` and delete them; nothing temporary gets committed.
- **Keep probes small.** A 40-tab × 14-screen × 3-form sweep exceeded a 300 s timeout twice. Cap tab loops (~14) and screens (~4) per probe, or you will lose the whole run.
- **`pkill -f <pattern>` matches the bash command that contains the pattern** — it kills your own shell and you get `exit -1` with no output. Don't use it; find the PID instead.

### Browser and UI behaviour

- **Native `<select>` cannot render `<option>` icons** — the validator rejects that combination (E-code), keep it that way.
- **No pre-ticked consent.** A consent checkbox must start unchecked (tested).
- **Date field copy cannot be render-verified** — text is assembled at runtime; verify in `schema/` and by eye.
- **The date inputs (year/month/day) use `placeholder` *and* a real `<label class="op-sr">`.** Placeholders are supplementary; do not remove the labels.
- **Numbers are language-neutral**: Ethiopic vs Latin digits are handled in `digits.ts`. Don't add digit logic inline elsewhere.
- **`addInitScript` does not inherit to newly opened pages** — set it per context/page.

### Git and shell

- **`git commit -m "…"` with backticks executes them.** Always write the message to a file and use `git commit -F /tmp/msg.txt`.
- **This repo has no configured git identity.** `git commit` fails with `fatal: empty ident name`. Use:
  ```bash
  GIT_AUTHOR_NAME="OpenPath Dev" GIT_AUTHOR_EMAIL="dev@openpath.local" \
  GIT_COMMITTER_NAME="OpenPath Dev" GIT_COMMITTER_EMAIL="dev@openpath.local" \
  git commit -F /tmp/msg.txt
  ```
- **`app/src/schemas/` is generated and gitignored.** `git add app/src/schemas` errors with "ignored by one of your .gitignore files". Only `schema/` is committed.
- A guard matching only a quoted third argument misses ternary forms; a usage check that only sees `c('key'` reports map-driven keys as unused; regex block replacement can leave a sibling language map behind (`TS6133`); literal extractors must handle both `'…'` and `` `…` ``.

---

## 11. Claims already withdrawn — do not re-raise

| Claim | Reality |
|---|---|
| "The employer voice test runs in Amharic." | It does not; the settings bar has a real "English" button, `getByRole` matched it. |
| "106 targets, 0 under 24×24." | That count excluded native inputs. Honest figure: 192 targets, 46 raw inputs at 23.2 px with 334×52 labels. |
| "`#cf3636` on the tint is a contrast failure." | It is a failing *token pair* (4.32:1) that never renders. The doc's 4.53 refers to the error surface. |
| "The language-of-parts criterion is not claimed anywhere." | It was claimed at `wcag-2.2-aa-conformance.md:122`, and the claim was false. Now fixed. |
| "A first plan needed to convert three test files." | Only one did: `a11y.spec.mjs` never walks the form (its "Dreṅa" hit is inside a CSS string) and `controls.mjs` already guarded. |

---

## 12. Content and privacy invariants

**Content**
- Amharic is the default language; English is the alternative. Amharic copy is written for low literacy: short sentences, one idea each.
- All three forms use the long button labels. Simple-words mode shortens copy but never changes the answer.
- Every string the app prints about itself lives in `schema/runtime-copy-v1.json` (73 keys). Form content lives in the form schemas. Keep that split.
- `i18n.ts` builders prevent an unfilled `{placeholder}` reaching the screen. Never concatenate user-facing strings by hand.

**Privacy (the user asks about this in judging)**
- `accessibility-prefs` is `localOnly: true` and is **never sent** — `tests/offline.mjs` asserts it is absent from the outbox.
- PII is stripped server-side per schema `pii` marking; only the reference number is kept after submit.
- Submissions are one append-only JSONL file on a named volume; no database, no secrets, no outbound calls (`tests/no-third-party.mjs`).
- Offline submit says "saved on this device", never "complete". A retry returns the same reference (200, not 201) — idempotent by `ref_`.
- `DATA_KEY` encrypts names/phones/IDs at rest when set; unset in dev.

---

## 13. Recipes for the changes you are most likely to make

**Edit form content (question, hint, option)**
```bash
# edit schema/savanna-*-v1.json
cd app && npm run sync:schemas && npm run validate     # expect 0 error(s), 0 warning(s)
npm run check                                          # 257, EXIT=0
```

**Edit a string the app prints about itself** (banner, announcement, settings label)
```bash
# edit schema/runtime-copy-v1.json + the c('key') call site
cd app && npm run sync:schemas && npm run copy && npm run announce && npm run check
```

**Change how a field renders** → `src/fields.tsx` (+ `styles.css` for styling). Then `npm run a11y`, `npm run focus`, `npm run check`.

**Touch announcements or `App.tsx` effects**
```bash
cd app && node tests/announce.mjs > /tmp/before.txt   # ALWAYS baseline first
# ...change...
node tests/announce.mjs > /tmp/after.txt && diff /tmp/before.txt /tmp/after.txt
npm run check && grep -c '✓' out.txt && grep -c '✗' out.txt   # 257 / 0
```

**Verify a11y claims** → re-run the probes described in §7.1. They were throwaway scripts; the durable evidence is in the three docs. If you write a new one, leave it in `app/tests/` with a comment saying what criterion it measures, and add it to `package.json` scripts so it stops being folklore.

---

## 14. Judging-day checklist (15 Nov, 16:30)

- [ ] `npm run check` green on a clean tree; `docker compose up -d --build` serves `/onboard`, `/job`, `/employer` on :8080.
- [ ] README installs in an hour from a cold start (25 points ride on this). Test it in a fresh clone, not in the working tree.
- [ ] `docs/wcag-2.2-aa-conformance.md` is current: 55 supported, 6 vacuous, 0 failures, corrections noted.
- [ ] Demo path rehearsed with **sound off**: language → prefs → assistance → name → phone → ID route → review → submit, plus one deliberate validation error to show the error summary, plus one offline submit.
- [ ] The sentence to say out loud: *"conformance is withheld until the co-designer sessions; here is exactly what is measured and what is not."* Judges respond better to that than to a claim of 100 %.
- [ ] `.git` bloat does not travel: submit a shallow clone or an exported tree.

---

## 15. Where to read next

| File | One line |
|---|---|
| `README.md` | The judge's first contact: status, the five-gate table, 17-row WCAG table, honest limitations. |
| `hackathon-2day.md` | The weekend build sheet and submission requirements. |
| `docs/wcag-2.2-aa-conformance.md` | The conformance report (gate deliverable). |
| `docs/wcag-2.2-aa-audit-2026-11-13.md` | The 16 criteria, each with its measurement. |
| `docs/judging-day-check-2026-11-13.md` | Seven bug patterns, nine self-checks, the official gate. |
| `docs/backlog.md` | W13 and friends — what was deliberately deferred. |
| `docs/a11y-field-matrix.md` | Which step types carry which a11y features. |
| `docs/amharic-voice.md` | Amharic TTS/ASR constraints and choices. |
| `docs/low-literacy-copy-spec.md` | The writing rules for simple-words mode. |
| `docs/audio-recording-list.md` | What gets recorded and why. |
| `docs/form-parity.md` | How the three schemas stay aligned. |
| `docs/integration-levels.md` | Script tag / REST API / LTI — adoption levels. |
| `docs/schema-audit-review.md`, `docs/fix-plan.md`, `docs/parallel-build-plan.md` | History of how the schemas and lanes were settled. |

---

## 16. If you have one hour and no context

1. `cd app && npm install && npx playwright install chromium`, then `npm run dev` in shell A.
2. `npm run check` in shell B → confirm 257 / EXIT=0.
3. Read `hackathon-2day.md` (the plan that matters) and §9 of this file (how the user wants to be worked with).
4. Open the form at `http://127.0.0.1:5173/onboard` with the sound off and your hands on the keyboard only. That is the judges' gate; you will learn more in ten minutes than from any document.
5. Ask the user one plain question about what they want next. Do not present them a menu.
