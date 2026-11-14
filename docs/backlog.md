# Backlog — everything still open

**Updated 13 Nov 2026.** One list so nothing lives in someone's head. `P0` blocks the submission,
`P1` is a scoring risk, `P2` is a real but survivable gap. Every task names its acceptance test —
if it does not have one, it is not a task yet.

Related: `docs/parallel-build-plan.md` (who does what), `docs/fix-plan.md` (done),
`docs/wcag-2.2-aa-conformance.md` (the claim these tasks protect).

---

## Answering the two questions you asked

**"Can we do generation-once with a paid key, then play the recording?"**
Yes — implemented and tested (`npm run audio:generate`, 12 assertions). The runtime never calls a
provider; the key lives in the environment; the clip is a static file from then on.
See `docs/audio-generation.md`.

**"Will it need a database?"**
No. The clip's file name is `FNV-1a("<lang>|<text>")` — the content is the key. A folder is the
store, `index.json` is the index, `provenance.json` is the audit log. SQLite would only earn its
place if you later need a generation queue with retry status across restarts or per-key spend
accounting.

---

## P0 — before 16:30 Sunday

| ID | Task | Why | Acceptance test | Owner |
|---|---|---|---|---|
| **P0-1** | `job-support` sends interview accommodations to the employer with `consentRequired: false`. Add a consent gate (or set it true and render the gate) | Disability-adjacent data reaches an employer with no explicit yes — a judge finds this by reading two JSON files | Validator **E23** extended: `recipient: "employer"` + `pii: personal` requires `consentRequired: true`; `api.mjs` asserts a job submission without consent is refused | Dev B |
| **P0-2** | Co-designer sessions (NVDA, TalkBack, keyboard-only, 200 % zoom, sound off) | The gate is a human, not an audit | Results recorded in the conformance report §7; anything found is fixed | the team |
| **P0-3** | Update the conformance report §7 and §8 with the real session results | It ships as a claim | The blanks are filled and the signature line has a name | whoever runs them |

## P1 — scoring risk, do it if the clock allows

| ID | Task | Why | Acceptance test |
|---|---|---|---|
| **P1-1** | Record **33 Amharic clips** for the learner form (intro, 10 questions, 5 hints, consent lines, 6 identity options) | The phone cannot speak Amharic; without clips, read-aloud says "this device cannot read Amharic" to the people it exists for | `npm run audio` reports the learner form at 100 % coverage; `npm run audio --list` is empty for that form |
| **P1-2** | Rewrite the 18 noun-only `simple` strings + delete the ones that fall back | Simple mode currently shows `ስም` where the full text says "write your name" — shorter and worse | `npm run literacy:strict` passes |
| **P1-3** | Icon audit + 5-person guessing test | `speaker` means three things, `doc` means five | ≥ 4 of 5 people agree on every icon's meaning; collisions fixed |
| **P1-4** | Mic privacy: hide it on the ID field, or disclose that Chrome sends audio to the browser vendor — **now also applies to step 1, which has a microphone** | We claim "nothing leaves this device" while STT streams the ID number's dictation to a third party | Validator **E26**: `pii: sensitive` may not have `voice: true`; `controls.mjs` asserts no mic on `id-value` |
| **P1-5** | `DATA_KEY` set in the deployed demo, and `/api/health` reporting `encryption: "none"` when unset | Encryption at rest exists but is opt-in and invisible | `api.mjs` asserts `/health` reports the encryption state |

### Done this week (was on the list)

| Was | Now |
|---|---|
| Voice silently did nothing on a choice step when the transcript matched no option | `matchChoice()` + a "I did not catch that — pick one:" card with the real options. 5 assertions in `voice.mjs` |
| No microphone on the language question | `voice: true` on `language`; it listens in `am-ET` then `en-US` and matches "Amharic"/"English"/"አማርኛ"/"እንግሊዝኛ" |
| No honest message when the phone has no Amharic speech model | It now says *"Speech recognition is not available for Amharic or English on this device"* and points at the buttons |

### What to expect when you test STT yourself

| Case | What happens |
|---|---|
| Chrome, English, "English" / "Amharic" on step 1 | works — matched, shown in the review card, applied on accept |
| Chrome, Amharic (`am-ET`) | Chrome has **no Amharic speech model**; it errors `language-not-supported`, we fall back to `en-US`, and if that hears nothing you get the honest message. **Your doubt is correct** — Amharic STT does not exist in the browser today |
| Firefox / Safari | `SpeechRecognition` is absent → the button is not rendered at all (no silent dead end) |
| No microphone permission | `not-allowed` → falls back to the buttons |

## P2 — real, survivable, or next week

| ID | Task | Notes |
|---|---|---|
| **P2-1** | Job + employer forms don't ask language first the way the learner form does | 3.1.1 is met; consistency of approach is not |
| **P2-2** | W12 validator rule: a `simple` string longer than the full string is suspicious | 30 minutes, prevents copy-paste regressions |
| **P2-3** | `hint.simple` and simplified error messages (8 rules, 11 hints) | Listed in `docs/low-literacy-copy-spec.md` §3 |
| **P2-4** | English clips (79) | Device voice already works in English; this is quality, not a fix |
| **P2-5** | Recorded-audio test: assert a present clip is played instead of TTS | Needs a committed silent clip fixture; `tests/audio.mjs` covers the build side today |

---

## Integration levels — pending

| ID | Task | Level | Effort | Acceptance test |
|---|---|---|---|---|
| **INT-1** | **`public/embed.js` loader + `docs/embed-contract.md`.** `<script src="…/embed.js" data-form="onboard" data-target="#signup">` creates a titled iframe, sizes it, and speaks a versioned `postMessage` contract (`ready`, `resize`, `submitted` with the reference, `error`) | **L1** | ~4 h | `tests/embed.mjs`: host page on another port completes the form inside the iframe and receives `submitted` with a real `sub_…` reference; axe clean on the host page |
| **INT-2** | **Nothing to do** — REST + OpenAPI 3.1 + parity test already ship | **L2** | done | `npm run api` (41 assertions) |
| **INT-3** | **schema.org/JobPosting JSON-LD** from the employer form: `jobTitle`, `hiringOrganization`, `jobLocation`, accessibility summary. Either a `<script type="application/ld+json">` on the employer page or `GET /api/forms/{id}/jsonld` | **L3** | ~3–4 h | Validator test: JSON-LD parses, required JobPosting properties present, no PII in the output |
| **INT-4** | LTI 1.3 (OIDC login, JWT signing, JWKS, deep linking, AGS) | **L3 alt** | 10–14 h | Needs a real LMS instance; schedule for the paid weeks, not the weekend |
| **INT-5** | Open Badges 3.0 (VC 2.0, Ed25519, DID) | **L3 alt** | 6–8 h | Off-message since course enrolment was dropped; only if a badge is wanted for completion |

**Claim for the deck until INT-1 lands: Level 2**, with Level 3 costed as schema.org/JobPosting.
See `docs/integration-levels.md`.

---

## Audio generation — pending

| ID | Task | Effort | Acceptance test |
|---|---|---|---|
| **AUDIO-1** | Add provider adapters: Azure (SSML, slower rate for low-literacy), ElevenLabs, and a **self-hosted OmniVoice** endpoint | 30 min each | Each adapter generates one clip end-to-end against a real key or a local model |
| **AUDIO-2** | Rule + check: **one voice per form.** `provenance.json` records source per clip; fail the build if a form mixes `human` and `generated` without an explicit allow | 1 h | `tests/audio.mjs` asserts a mixed form fails unless `--allow-mixed` |
| **AUDIO-3** | Admin endpoint `POST /api/admin/audio/generate` (server-side key, dry-run by default, returns cost estimate), plus a one-button page for non-technical adopters | 4 h | Asserted in `api.mjs`: no key → 503 with a message; dry run → estimate only; write → files appear and index updates |
| **AUDIO-4** | Document the licence check per provider ("the audio files travel with the repo forever") | 30 min | A line in `schema/README.md` for adopters |
| ~~**AUDIO-5**~~ | **Decided and built.** `POST /api/transcribe` behind `ASR_URL`/`ASR_KEY`/`ASR_MODEL`; audio never stored; disclosure shown while recording; mic still absent on the ID field and consent screens | done | `tests/transcribe.mjs` — 503 when unconfigured, real transcript through a fake engine, 415/413 refused, browser falls through and gets a review card |
| **W12-b** | **Co-designer check on the shortened intro.** "Take your time. No rush." no longer says what happens next; confirm nobody wonders what they are starting before deciding whether to add *"A few questions. Then done."* | 30 min in the session | The person starts answering without asking | 
| ~~**W12-f**~~ | **Employer form brought to parity.** Same two opening screens, welcome line, full `ui` vocabulary, written error messages, *why* under every field, simple twins for long labels — and the parity test's exemption list is now empty | done | `node tests/parity.mjs` — no `EXEMPT` entry, all three forms measured |
| **W12-g** | **Native review of the new job *and employer* Amharic.** `contentStatus` is `partly-unreviewed` until someone reads it aloud; the grammar pass on 13 Nov found five errors in copy that had been marked reviewed | 45 min with the co-designer | Status back to `reviewed`, `contentReview` names the reader and date |
| **W12-e** | **Two options share one icon**: `id-route` uses the same page glyph for *ሌላ ሰነድ* and *ምንም መታወቂያ የለኝም*. For a low-literacy reader the icon is half the label, so duplicates cost more here than elsewhere | 20 min | Every option in a step has a distinct icon, asserted in a test |
| **W12-c** | **`errors.exclusiveOption` can never fire.** No option in any form is marked `"exclusive": true`, so "If you choose this, you do not need to choose anything else" is unreachable — and `id-route` lets a person pick **ምንም መታወቂያ የለኝም** *and* **ፓስፖርት** at once, which contradicts itself. One-line fix: `"exclusive": true` on `no-document` | 15 min | `validate.mjs` or a test asserts contradicting pairs cannot both be selected |
| **W12-d** | **The review screen's `hint` is spoken but never shown.** `App.tsx` puts `st.hint` in `readAloudText()`; `ReviewScreen` renders no hint. Either show the sentence ("You can change what you want") above the list or remove it from the spoken text — a person should not hear a sentence that is not on the screen | 30 min | The review screen's visible text and read-aloud text match, asserted in `voice.mjs` |
| **AUDIO-6** | **Deploy the engine for the demo.** Run `whisper.cpp` (Amharic-small or `large-v3`) on the same box as the API, set `ASR_URL=http://127.0.0.1:8080/inference`, then record one real Amharic sentence end-to-end | 2 h incl. model download | A co-designer speaks Amharic and the review card shows the words; `health` says `transcription: "configured"` |
| **AUDIO-7** | **Say it in the submission, not just the code.** One panel: *browser STT is free but has no Amharic; this is the engine we self-host, here is who sees the audio, here is the button that deletes it* | 1 h | Wording reviewed against `docs/audio-generation.md` §6 |

---

## The one thing not on this list

Nothing here changes the gate. The gate is a person completing the form unaided, and **P0-2 is the
only task on this page that can fail the submission by itself.** If Sunday gets tight, cut P1-3,
P2-*, and every AUDIO and INT item before cutting the co-designer session.

## W13 — runtime copy is not in the audio manifest (deliberate, revisit after the hackathon)

`schema/runtime-copy-v1.json` holds the copy the app prints about itself: send status, the
connectivity banner, the eight microphone error causes, the date field labels. It is validated and
reviewed like the forms, but it is **not** in `scripts/_strings.mjs`, so read-aloud does not speak
it and there are no clips for it.

That is a deliberate gap, decided on 13 Nov: adding it would put roughly 120 more clips on the
recording list two days before submission, and the strings it covers are announced by the screen
reader through `aria-live` regions already. The gap, stated plainly: a person using our own
read-aloud button will not hear "You are offline" spoken by our voice layer.

Cost to close it later: add a `ui`/`runtime` pass to `_strings.mjs`, re-baseline `tests/audio.mjs`,
record, and add the same strings to the read-aloud path in App.tsx.
