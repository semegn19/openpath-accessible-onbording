# Parallel build plan — 3 people, 2.5 days

**Written:** Fri 13 Nov 2026 · **Submit:** Sun 15 Nov 16:30 · **Gate:** co-designer completes the
task unaided; axe zero critical/serious; WCAG 2.2 AA report

This document has three jobs: (1) check the three features you listed against what the code
actually does, (2) name what the codebase **lacks** for three people to work without colliding,
and (3) hand out work with file-level ownership so collisions cannot happen.

---

## 1. The three features, measured

You listed three. Two are already built and tested. The third is one-third built, and the third
that is missing is the part that matters most to a learner who cannot read.

### 1.1 "Voice input on every field, with review and edit" — **built, with two real defects**

| Claim | Evidence |
|---|---|
| Every field | `voice: true` on **18 of 18** input steps across the three forms. The mic is suppressed on the **4 consent screens** on purpose (validator rule **E22** + a renderer guard) — a dictated consent is not consent. |
| Review and edit | `VoiceButton` has three phases: `listening → review → idle`. Review shows **"We heard: …"** and, when the transcript is rewritten, **"We will use: …"** in a second line, then *That is right / Try again / Type instead*. Nothing is written into the field until the person presses *That is right*. |
| Spoken digits | `digits.ts` converts "ዘጠኝ አንድ አንድ" → `911`, and retries in the other language if the first pass changes nothing. Both the heard and the used string are shown. |

**The two defects to fix (these are Dev A's first tasks):**

1. **A choice step silently does nothing when the transcript does not match.** `fields.tsx` does
   `options.find(o => t(o.label, lang).includes(text.trim()))` — if a person says "quiet room"
   and no label contains that string, there is no feedback at all: the card closes and the
   checkbox stays unticked. Silent failure on the *lowest-confidence* input path. Must say
   "I did not catch that" and offer the list.
2. **Cloud speech contradicts the privacy claim.** Chrome's `SpeechRecognition` streams audio to
   the browser vendor's servers. Our own `npm run hosts` cannot see that — it is browser-level, not
   page-level — so we have been able to claim "nothing leaves this device" while the mic on
   `name` and `id-value` was sending a voice recording of exactly that. Either block the mic on
   `pii` fields, or say plainly what happens. **Do not ship the current silence.** This is a
   15-point rubric item ("security and privacy") and the one place where a judge can catch us
   overclaiming.

### 1.2 "A private way to ask for support, no medical proof" — **built, one real hole**

| Claim | Evidence |
|---|---|
| Private | `accessibility-prefs` is `localOnly` — it never leaves the device; the server has it in `NEVER_STORED` and would strip it if it arrived. |
| Asks for help | `assistance` is a separate, explicit yes/no that **is** sent (name + phone only) — because a help button that reaches nobody is worse than no help button. |
| No medical proof | There is no field to put a diagnosis in, and `assistance.sharing.fields` names `name` and `phone` only. Validator **E23** refuses a `sharing` block that does not name its fields or its recipient. |
| Three states | `localOnly` vs `sharing` vs neither — `schema/README.md` § Privacy vocabulary. |

**The hole (Dev B's first task, P0):** the job form's `job-support` step sends interview
accommodations (sign-language interpreter, quiet room) to `recipient: "employer"` with
**`consentRequired: false`**. Disability-adjacent information reaching an employer, on a screen
with no consent gate — while the learner form's referral *has* one. That is an inconsistency a
judge can find by reading two JSON files, and it is exactly the story we claim to have solved.

### 1.3 "A low-literacy path: simple words, icons, read-aloud" — **one-third built**

| Piece | Status | Evidence |
|---|---|---|
| Read-aloud questions | ✅ **Built** | 16 of 18 input steps + all 4 consent screens; reads question, hint, body and consent option labels (`readAloudText`). |
| Icons | ✅ **Built** | Every option in every choice step has an icon (`noIcon: 0`). |
| Simple words | ❌ **Not written** | The plumbing exists — a `simple` toggle that re-renders, `label.simple` / `step.simple` in `types.ts`. **No schema contains a single `simple` string.** Turning on "simple words" today changes *nothing* for 18 of 18 questions. |

This is the gap that matters most for the people the hackathon is about: a learner who cannot
read comfortably gets a working form with an unreadable question. It is also the cheapest large
win on the board — it is **writing, not engineering**, ~70 strings in two languages, and you are
the native speaker who can write them.

Also missing inside #3: error messages, hints, option labels and the review screen are not
simplified, and nothing verifies that a `simple` string is actually *simpler* (shorter is a
decent proxy: `npm run validate` can warn on a `simple` string that is not shorter than the full
one).

---

## 2. What the codebase lacks to run 3 people in parallel

Not nice-to-haves. Each of these is a way two people collide or one person blocks.

| # | Problem | Why it blocks parallelism | Cost to fix |
|---|---|---|---|
| **L1** | **`App.tsx` is 480 lines with 33 inline `lang === 'am' ? … : …` ternaries**, and it owns the step screen, the done screen, both banners, the settings bar wiring and the submit flow. | All three workstreams need to touch it (A: voice copy, B: consent copy, C: simple copy). Whoever edits first, the others rebase. | ~2 h, one person, **before** branching |
| **L2** | **`fields.tsx` is one 260-line file** holding every input type, the option renderer *and* the voice row. | Dev A (voice) and Dev C (simple/options) both edit it. This is the guaranteed conflict. | ~1 h, extract `fields/voice-row.tsx` + `fields/options.tsx` |
| **L3** | **Tests only cover the learner form.** `a11y.spec.mjs`, `offline.mjs`, `submit.mjs`, `focus-obscured.mjs` all walk `/onboard`. Job and employer are only *fetched*, never filled. | Dev C rewriting job/employer content has no way to know it did not break the walk; Dev B changing the job privacy steps cannot verify. "It works on my machine" for two of three forms. | ~1.5 h: make `_flow.mjs` take a form descriptor |
| **L4** | **No lint, no format, no CI.** No `eslint`, no `prettier`, no `.editorconfig`, no `.github/`. | Nothing stops a merge that fails typecheck; nobody can run the gate without a laptop and 80 s; style drift makes every diff noisy. | ~45 min |
| **L5** | **Ports and servers are hardcoded** (`5173`, `8080`, `8081`, `8085`, `8091`, `8096`, `8097` across the test scripts). | Two devs running `npm run check` at once fight over ports and kill each other's servers — the exact class of failure that already produced a phantom 500 in this project. | ~45 min, env-driven |
| **L6** | **The three schema JSON files are the shared surface** for Dev B (privacy keys) and Dev C (`simple` keys). | Hand-editing the same JSON in two branches = conflicts in the one file type that is hardest to resolve by eye. | Mitigation, not a fix: C ships a script (§4.4) |
| **L7** | **No issue board.** The work lives in `docs/fix-plan.md` (done) and this file. | Three people, no shared list of who is doing what = the plan in someone's head. | §4 of this doc is copy-pasteable |
| **L8** | **Voice is not tested beyond one field.** `voice.mjs` covers the tel field; the choice-matching path and the "no match" path have no test — which is why defect 1.1.1 went unnoticed. | Dev A cannot refactor the matcher safely. Needs a fake `SpeechRecognition` (Playwright `addInitScript`), which does not exist yet. | Part of A1 |

**What is already good and should not be touched during the parallel phase:** `schema/validate.mjs`
(26 error codes), `src/outbox.ts`, `api/server.mjs` encryption, `tests/offline.mjs`. These are green
and load-bearing; a refactor that touches them at 3 a.m. on Sunday costs the gate.

---

## 3. The rule that makes parallelism work here

> **Contracts first, then branches. Nobody edits a shared file; everybody edits a file they own.**

Two hours on Friday evening buys the rest of the weekend. Concretely, before anyone starts:

| Step | Output | Owner |
|---|---|---|
| C1 | Extract copy from `App.tsx` into `src/copy.ts` (typed, `am`/`en`, grouped by screen). `App.tsx` renders strings, never writes them. | whoever is fastest |
| C2 | Split `fields.tsx` → `fields/inputs.tsx`, `fields/options.tsx`, `fields/voice-row.tsx` | same |
| C3 | `tests/_flow.mjs` takes `{ slug, steps, labels }`; every walk works on all three forms | same |
| C4 | Ports from env with defaults; `npm run check` runs clean twice in parallel | same |
| C5 | `.github/workflows/check.yml` runs `npm run check` on push + PR | same |
| C6 | Agree the **schema key contract** (§4.5) so B and C never add the same key | all three, 15 minutes |

Until C1–C6 land, three people editing this repo will spend Saturday rebasing instead of
building — and time is the only resource that cannot be refactored.

---

## 4. The work, split three ways

Ownership is by **file**, so a merge conflict is a mistake, not bad luck.

### 4.1 Dev A — Voice and input (owns `src/speech.tsx`, `src/digits.ts`, `fields/voice-row.tsx`, `tests/voice.mjs`)

| ID | Task | Acceptance test | Size |
|---|---|---|---|
| **A1** | Choice-step dictation must never fail silently: match on the option label **and** a small alias list (`value`, label, first word); on no match show "I did not catch that — pick one:" with the real options underneath | New: 3 assertions in `voice.mjs` using a stubbed `SpeechRecognition` — match, no-match, re-listen | 3 h |
| **A2** | **Privacy of the mic.** Decide and implement: mic hidden on `pii: sensitive`/`id-value`, or a one-line disclosure above the card ("your voice is sent to the browser maker's speech service"). Recommend: hide on ID, disclose globally | Validator rule **E26**: a `sensitive` step may not have `voice: true`; test asserts the mic is absent on `id-value` | 2 h |
| **A3** | **Review every voice-entered answer before submit.** The review screen marks answers that came from dictation, so a wrong transcript is visible before it is sent, not after | `a11y.spec` assertion: dictated name appears flagged on review | 2 h |
| **A4** | Dictation for the `textarea` and `number` fields with the same review card (coverage, not new code) | `voice.mjs` counts: mic present on 18/18 input steps | 1 h |
| **A5** | Firefox/Safari: the mic must explain itself, not vanish (a hidden capability is indistinguishable from a missing one) | Assert the explanatory text renders when `SpeechRecognition` is absent | 45 min |

### 4.2 Dev B — Privacy and support (owns `schema/*.json` **privacy keys**, `api/server.mjs` privacy paths, `schema/validate.mjs`, `tests/api.mjs`)

| ID | Task | Acceptance test | Size |
|---|---|---|---|
| **B1** | **P0 — close the `job-support` hole.** Interview accommodations reach the employer with `consentRequired: false`. Add a consent step before it on the job form (mirror `referral`), or set `consentRequired: true` and render the gate | Validator **E23** extended: `sharing.recipient: "employer"` with `pii: personal` requires `consentRequired: true`; `api.mjs` asserts a job submission without consent is refused | 2.5 h |
| **B2** | **Say who will call, and when.** The `assistance` promise is "somebody will contact you" with no recipient, no timeframe. Put it in the schema (`sharing.recipient`, `purpose`, `responseWithin`) and on the screen | `pages.mjs` asserts the sentence appears in both languages | 1.5 h |
| **B3** | **The partner is configurable, and unconfirmed.** `partner.status: "unconfirmed"` exists; prove an adopter can point it at their own organisation by changing one JSON block, and document it in `schema/README.md` | A test that loads a mutated schema copy and asserts the new name renders | 1.5 h |
| **B4** | **Privacy regression suite.** One command that proves, end to end: prefs never leave, assistance carries name+phone only, ID is encrypted at rest, dictation audio is not a payload | `api.mjs` + `offline.mjs` assertions already exist — consolidate into `npm run privacy` | 1.5 h |
| **B5** | **P1 — the sentence we cannot say.** If `DATA_KEY` is unset the API stores plaintext. Make the health endpoint report `encryption: "none"` and the README/deploy docs say what that means | `api.mjs` asserts `/health` reports the encryption state | 1 h |

### 4.3 Dev C — Low literacy (owns `schema/*.json` **`simple` keys only**, `src/i18n.ts`, `fields/options.tsx`, `tests/simple.mjs`)

| ID | Task | Acceptance test | Size |
|---|---|---|---|
| **C1** | **Write `simple` for all 18 questions × 2 languages** — you, as the native speaker. Short sentences, no borrowed Amharic, no formal register. This is the single highest-value afternoon on the board | `simple.mjs`: toggling "simple words" changes 18/18 question texts and each is shorter than the full one | 3 h (yours) |
| **C2** | Simplify **hints and error messages** (`hint.simple`, and error strings keyed by validator rule + language) | Assert 1 message per rule in both languages; `simple` variant ≤ 60 characters | 2 h |
| **C3** | Simplify **option labels** (`option.label.simple`) for the 6 identity routes and 5 job-support options — the two places with the longest labels | Count assertion: all options have `.simple` | 2 h |
| **C4** | **Simple mode must reach the review screen and the done screen**, not just the questions — the last two screens are read at the least-attended moment | `simple.mjs` audits review + done in simple mode | 1.5 h |
| **C5** | **Wire `simple` in by default for the school/adult-literacy cohort?** Decide honestly; if not, at least make the toggle say what it does ("Simple words: on") |  | 1 h |
| **C6** | Validator: **W12** — a `simple` string that is not shorter than the full string is suspicious (catches copy-paste) | Negative test with a mutated schema | 30 min |

### 4.4 How B and C share the JSON files without conflicting

C does **not** hand-edit the three schema files. C writes `schema/scripts/add-simple.mjs`, which
merges a `simple.json` side table into the forms and is idempotent — the same pattern as the
existing `sync-schemas` step. B edits privacy keys by hand, in the same files, in a different
commit. A JSON conflict then becomes impossible: one lane is a script, the other is a diff of
different keys.

### 4.5 The schema key contract (agreed once, in writing)

```jsonc
// Dev C adds, and only these:
"simple": { "am": "…", "en": "…" }            // on a step — the short question
"hint":   { "am": "…", "en": "…", "simple": { … } }
"options": [{ "value": "…", "label": { …, "simple": { … } } }]

// Dev B adds, and only these:
"sharing": { "recipient": …, "fields": […], "purpose": …, "consentRequired": true,
             "responseWithin": { "am": "…", "en": "…" } }
"partner": { "status": "unconfirmed" | "confirmed", … }
```

Anyone who needs a key outside their lane asks first. That is the whole cost of not conflicting.

---

## 5. The calendar

| When | Dev A (voice) | Dev B (privacy) | Dev C (low literacy) | Shared |
|---|---|---|---|---|
| **Fri evening** | C1–C6 contracts land first; everyone waits | ← | ← | 2 h, together |
| **Sat 09:00–13:00** | A1, A2 | B1, B2 | C1 (writing) | — |
| **Sat 13:00–14:00** | **First co-designer session** — do not postpone this. Saturday morning is a buffer, Sunday afternoon is not | | | all three watch, one takes notes |
| **Sat 14:00–17:00** | A3, A4 | B3, B4 | C2, C3 | 16:30: `npm run check` on `main` must be green |
| **Sun 09:00–12:00** | A5 + fix what the co-designer found | B5 + fix findings | C4, C6 + fix findings (you own the language fixes) | — |
| **Sun 12:00** | **Code freeze.** No merges after this except co-designer fixes | | | |
| **Sun 12:30–14:30** | **Second and third co-designer sessions** (TalkBack, keyboard-only) | | | |
| **Sun 14:30–16:00** | Update the conformance report §7 with the real results; final `npm run check`; screenshots | | | |
| **Sun 16:00** | Submit (30 min before the deadline, deliberately) | | | |

**Hard rules for the weekend:** `main` is always green — if you break it, you fix it before you
do anything else. Every task ships with its test. Nothing merges without `npm run check` passing
locally. The freeze at 12:00 Sunday is real; the 15:00 "one more feature" is how submissions get
lost.

---

## 6. What must not be parallelised

| Do not split | Why |
|---|---|
| The schema key contract (§4.5) | Two people inventing different shapes for `simple` costs an afternoon of reconciliation |
| `src/outbox.ts`, `api/server.mjs` encryption, `tests/offline.mjs` | Green, load-bearing, and untouched by the three features. Leave them alone |
| The conformance report | One author, one voice. Multiple editors of a compliance document produce a document nobody believes |
| The demo script | Written once, by the person who will speak it |

---

## 7. The honest summary for the deck

The three items on your list, as they stand:

- **Voice with review and edit — done**, on 18 of 18 fields, with a confirm step; two defects to
  fix, one of them (cloud speech vs "nothing leaves this device") a claim we should not make as
  written.
- **Private support, no medical proof — done**, with three enforcement layers and one
  inconsistency on the employer form that a judge could find in two minutes.
- **Low-literacy path — half done**: read-aloud and icons across the whole form, and **no simple
  words at all**. That is the gap between "an accessible form" and "a form a person who reads
  slowly can actually finish", and it is writing, not engineering — your afternoon, not your
  teammates'.
