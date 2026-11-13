# P1 — Hackathon sprint (10 days)

**Phase:** P1 · **Parent plan:** §7 ("Phase 0 — the 10-day hackathon sprint" in the parent's older numbering) · **Document version:** 1.0 · **Written:** 13 Nov 2026

| | |
|---|---|
| **Window** | 10 working days, 3 engineers + 1 designer |
| **Goal** | A live, device-verified demo of all five acts, on real hardware, with an honest descope story — plus a reusable core that P2 hardens rather than rewrites |
| **Deliverable** | `apps/demo` deployed at a public Ethiopian-hosted URL + **14 library components** at sprint-DoD + engine + speech stack + embed channel + recorded fallback |
| **Not the deliverable** | a finished product, full WCAG-EM evidence, live eSignet, EthSL, symbol grid, production data handling |
| **Exit** | `scripts/demo-readiness.ts --act=all` exits 0 · all five acts pass twice on device, once in front of someone who did not build them · U0 walkthrough done with top-5 defects recorded |

> **Read §1 before writing code.** Scope is 1.4× capacity, reduced to ~4 eng-days of residual pressure by the pre-pulled ladder. The cut order is pre-agreed and is *part of the plan*, not a contingency. If you build in the order below, stopping at any point leaves a shippable demo.

---

## 1. Reality check — the arithmetic, done properly

The parent plan says the source report's Day 1–10 sequence contains ~50–60 eng-days against ~30 available. That is correct but not the useful number. The useful number is what *our* five acts and 18-component promise actually cost:

| Work | Eng-days |
|---|---|
| Engine: reducer, validation, keyed errors, branch, prefill, history, pacing projection, IndexedDB autosave, recovery, announcer, review model | **7.0** |
| Components: Tier A 12.5 + Tier B 3.25 + six demo-local views 1.85 | **17.6** |
| Backend: Fastify, schema/session endpoints, autosave sync, ASR proxy, TTS proxy + hash cache, mock IdP, consent log, hardening, Service Worker | **7.5** |
| Embed channel (light-DOM custom element in the Savanna Bootstrap fixture) | **1.0** |
| Demo app wiring + content hookup | **2.0** |
| AT pass (day 9) + integration + rehearsal + triage | **4.5** |
| **Total required for the parent plan's 18-component, 5-act Phase 0** | **≈ 39.6** |

**Capacity:** 3 engineers × 10 days = 30 gross ≈ **24 productive** after reviews, deploy and rehearsal — plus the designer acts as a second-class builder for ~4 days on the demo shell and the six local views. Call it **≈ 28 productive eng-days**.

**Gap: ≈ 11.6 eng-days (1.4×).** Anyone who tells you 18 components and 5 acts fit in 10 days with three people has not counted. The plan is therefore:

1. **The descope ladder in §8.1 is pulled on day 1, not when you are behind.** It removes 3.95 eng-days from the engineers' books and 3.35 from the demo wiring/views (now the designer's), taking 39.6 → **32.3 against 28 — a 1.15× gap, not a fantasy.**
2. **14 components are committed (Tier A, 12.5 d).** They are ordered so the five acts are *complete* at component 14 — nothing after that point is load-bearing for the demo. **4 more (Tier B) are conditional** on days 1–6 landing clean; they are what makes act 5 the act as written. **4 (Tier C) go to P2.**
3. **The remaining ~4.3 eng-days are closed by §8.3, and the flex is act 5.** Say this to stakeholders now, in these words: *"Acts 1–4 live and device-verified. Act 5 live as designed if day 7 lands clean; otherwise tap-to-hear plus typed input, and we say so on stage."* Everything else in the demo is not negotiable.
4. **A 15-day variant exists** (Appendix A) and it is the only version that fits comfortably. If the event window is negotiable, take it.

> **The stop rule.** Tier A is ordered as a demo-completion sequence, not an alphabet. If the sprint ends early, the demo is still whole — it just has fewer adaptive and speech components than the pitch claims. **Never** let the schedule shorten the acts by removing the error contract, offline recovery or lossless mode switching (§8.4).

### 1.1 What P1 must not redo

P0 already delivered these. Building them again is the most expensive possible mistake:

| Already done | Verify with |
|---|---|
| Monorepo, CI, boundaries, package skeletons | `pnpm ci` |
| Schema types + zod + `schema-lint` (OP001–OP010) + frozen demo schema | `pnpm schema:lint schemas/savanna-onboarding-v1.json` |
| String catalogue + `strings-lint` + i18n runtime | `pnpm strings:lint` |
| **Verified calendar adapter** (melaku-z ships, kenat verifies, 60 vectors, range guard) | `pnpm ethiopia:verify` → 60/60 |
| HDX address importer + 14-region/zone/woreda dataset + free-text escape design | `pnpm ethiopia:address:verify` |
| Tokens, `.op-root`, `@layer`, contrast validator, **audited Savanna theme** | `pnpm tokens:contrast --theme=all` |
| ADRs 0001–0014, host contract, device lab, a11y statement skeleton | `pnpm docs:lint` |
| Host fixture (`apps/demo/host-bootstrap` + pinned Savanna clone) | `bash scripts/fetch-host-fixture.sh` |
| Baseline kit, procurement register, budget | `pnpm ops:lint` |

**Do not re-derive the calendar, do not re-pick the address design, do not restyle the Savanna tokens.** Each of those was settled with evidence and is recorded in `docs/decisions/` and `phases/assets/`.

---

## 2. Entry gates — check these before day 1

Run this first. A failed gate here is cheaper than a failed day 4.

```bash
pnpm preflight:verify          # P0's full gate set; exit 0 required
pnpm demo:readiness --act=none # environment + credential checks only (see §10.1)
```

| # | Gate | Owner | If it fails |
|---|---|---|---|
| G1 | `pnpm preflight:verify` exits 0 on a clean clone | Eng A | Stop. Fix P0 debt first — it is 1 day now or 3 days later |
| G2 | Addis AI keys + quota verified by live curl **from Addis Ababa**, p50 recorded | Eng C | Degrade: Tier-0 audio + Azure TTS + typed input. Acts 1–4 survive; act 5 becomes read-only |
| G3 | Azure Speech am-ET-Ameha key + quota verified | Eng C | Tier 0 only; acts 1–4 unaffected |
| G4 | 40 Tier-0 Amharic Opus prompts recorded and editor-approved | Design + studio | Acts 2, 5 degrade to on-screen text + transcript. **Not fatal** — but say so in the pitch |
| G5 | String freeze v1 (≈120 am/en strings) for the demo path only | Editor | Demo runs in English only with Amharic hiding; loses act 2's point |
| G6 | Demo schema frozen (`schemas/.frozen.sha256` matches) | Eng A | Freeze it now. Schema changes during the sprint cost ~0.5 day each |
| G7 | Devices charged and provisioned: Redmi 9A-class (Android 9), Pixel (13), Windows + NVDA | All | **Fatal for the manual AT gate.** Borrowing is acceptable once; borrowing on day 9 is not |
| G8 | Mock eSignet IdP contract running locally | Eng C | Cut identity to "Fayda FCN entry + document upload"; act 2 unaffected |
| G9 | OPD walkthrough booked for day 10 (3–4 people, compensated) | Design | Rehearse without them, but mark U0 as `NOT RUN` in the report — do not substitute colleagues and call it user research |
| G10 | Ethiopian-hosted staging box reachable over TLS | Eng C | Deploy to a documented fallback region for the **demo only**, and write down that it is not the production topology (§14, ADR-004) |

**Hard rule:** a failed G2/G3/G7 does not stop the sprint, but it *must* appear in the demo script as a stated limitation and in the report as a blocked item. A demo that quietly pretends a service worked is worse than one that names what broke.

---

## 3. Component roster — 14 committed, 4 conditional, 4 to P2

**Sprint-DoD ≠ §5.2 DoD.** See §4. Effort is per component *including* tests and the reduced axe matrix.

| # | Component | Tier | Demo act | Schema field(s) | Est. |
|---|---|---|---|---|---|
| 1 | `MultiStepForm` | A | 1 | whole form | 1.5 |
| 2 | `QuestionPage` (incl. step announce, progress text, help slot) | A | 1, 3 | every question step | 1.0 |
| 3 | `FieldGroup` (fieldset/legend, hint, error wiring — the shell all inputs use) | A | 1 | all grouped fields | 0.5 |
| 4 | `TextInput` (`text`/`email`/`number` via native `type`) | A | 1 | `given-name`, `father-name`, `grandfather-name`, `fayda-fcn`, `email`, `email`, `years-experience`, `contact-method-phone` | 0.5 |
| 5 | `RadioGroup` | A | 1, 2 | `sex`, `identity-method`, `contact-method`, `highest-education` | 0.5 |
| 6 | `CheckboxGroup` | A | 1 | `skills`, `accommodations`, `declaration` | 0.5 |
| 7 | `DateInput` (EC/GC toggle, year-only) | A | 2 | `date-of-birth` | 1.25 |
| 8 | `EthiopianAddressSelector` (3 native selects + free-text escape) | A | 2 | `address` | 1.0 |
| 9 | `ErrorSummary` (auto-focus, "Error:" title prefix, links to fields) | A | 1 | all | 0.75 |
| 10 | `FieldError` | A | 1 | all | 0.5 |
| 11 | `CheckYourAnswers` (`<dl>`, visually-hidden Change context) | A | 2 | `review` step | 1.0 |
| 12 | `AccessibilityPreferenceManager` | A | 3 | prefs panel | 0.75 |
| 13 | `EasyReadRenderer` (5 blocks) | A | 3 | `easyRead.blockId` | 0.75 |
| 14 | `AlternativeResponseComposer` (40-chip phrase bank, 2 categories) | A | 3 | `experience-summary` | 1.0 |
| | **Tier A total** | | | | **12.5** |
| 15 | `GuidedQuestion` (Listen / Easy-Read bar + transcript panel) | B | 5 | `readAloud` slots | 0.75 |
| 16 | `ReadAloudController` (Tier-0 lookup → Azure fallback, cancel on keypress) | B | 5 | `readAloud.promptKey` | 0.75 |
| 17 | `VoiceInput` (**one slot: name**, 60 s cap, push-to-talk) | B | 5 | `given-name` | 1.25 |
| 18 | `AnswerConfirmation` (visual + audio read-back, explicit accept) | B | 5 | ASR-filled values | 0.5 |
| | **Tier B total** | | | | **3.25** |
| 19 | `PhoneInput` (E.164 normalisation, no split boxes) | C | 1 | `phone` | 0.75 |
| 20 | `HumanHelpRequest` (link + dialog, identical position on every step) | C | 1 | `settings.helpChannels` | 0.4 |
| 21 | `FileUpload` (plain `<input type="file">` + doc-type list + spoken hint) | C | — | `id-document` | 0.75 |
| 22 | `SaveAndResume` (magic-link banner; no local token) | C | — | — | 0.5 |
| | **Tier C total** | | | | **2.4** |

**Committed in P1: 14 (Tier A, 12.5 d).** The five acts are complete at component 14.

**Conditional: 4 (Tier B, 3.25 d)** — builds on days 7–8 only if days 1–6 all hit their frozen outputs. Tier B *is* act 5 as scripted; without 15–18, act 5 is "tap-to-hear plus typed input" and must be pitched exactly that way, not quietly reworded.

**P2: 4 (Tier C, 2.4 d).** Explicitly not sprint work; `FileUpload` falls back to a plain `<input type="file">` and `SaveAndResume` to the recovery banner.

### 3.1 Demo-local views — not components, not exported

These six exist because the demo schema has fields the roster does not cover, and building them as libraries now would be padding. They live in `apps/demo/src/views/`, are **not** exported from `@openpath/react`, are not counted by `count:components`, and are converted in P2 only if U0 says they earned it:

| View | Why not a component | Est. |
|---|---|---|
| `SelectView` (native `<select>`) | A wrapper around a native element; the design question is settled | 0.25 |
| `TextareaView` (native `<textarea>`) | Same; char-count behaviour is a P2 decision | 0.25 |
| `ProgressIndicator` | "Step 3 of 12" + `<progress>`; the a11y contract for progress is a P2 question | 0.25 |
| `FormRecoveryBanner` | Act 4 needs it; multi-tab/conflict states are P2 | 0.25 |
| `DemoConsentBanner` | Demo-instance banner ("do not enter real personal information") | 0.1 |
| `WitnessBlock` | Conditional block for `identity-method === "witness"` | 0.25 |

**Rule:** a demo-local view may use raw HTML and the shared `FieldGroup`. It may **not** be imported by a library component, and it may not grow a public API.

---

## 4. Sprint DoD — a strict subset of §5.2, written down

The full §5.2 contract (storybook doc page, 6-state axe matrix, per-component NVDA **and** TalkBack verification, visual regression) is ~0.5 day per component → 7 days of the sprint for 14 components. Not possible. The sprint DoD is therefore:

**Required for every component (no exceptions):**
- [ ] Correct native element; no `role` on a `div`; group semantics via `<fieldset>`/`<legend>`
- [ ] Programmatic name starts with the visible label text (WCAG 2.5.3)
- [ ] `aria-describedby` order: hint → error; `aria-invalid` only when invalid; inline error and summary link share **identical wording** (from the keyed error code)
- [ ] Keyboard-complete; no trap; visible 3 px focus ring at ≥ 3:1 against surface **and** control
- [ ] Targets ≥ 48×48 with ≥ 8 px spacing (asserted, not eyeballed)
- [ ] No horizontal scroll at 320 CSS px / 400 % zoom; no fixed heights (survives 1.4.12 text spacing)
- [ ] Ge'ez: `line-height ≥ 1.65`, no italic, no clipped ascenders/descenders
- [ ] axe-core: **zero violations** in 3 states (default, focused, error) × 2 locales × 320 px
- [ ] Unit tests for logic; contract test rendered **inside the light-DOM custom element**
- [ ] `lang` correct on any Amharic string inside an English page and vice versa

**Deferred to P2, tracked as an explicit list, not forgotten:**

| Deferred | Lands in |
|---|---|
| Per-component docs page + Storybook a11y panel | P2 backlog item `HARD-01` (14 × 0.15 d ≈ 2.1 d) |
| axe states 4–6: conditional, 320 px forced-colors, `prefers-contrast: more` | `HARD-02` (≈ 1.5 d) |
| Per-component TalkBack verification (sprint verifies the *assembled demo*, not each component) | `HARD-03` (≈ 2.0 d) |
| Visual regression baselines (4 surfaces) | `HARD-04` (≈ 1.0 d) |
| `fieldset` inside `<h1>` single-question-page polish | `HARD-05` |
| Sticky-bar `scroll-margin-block` audit across all steps | `HARD-06` |

**If you find yourself widening this list to ship faster, stop and pull the §8 ladder instead.** Descoping components is recoverable. Descoping the error/focus contract is not — those are acts 1 and 3.

---

## 5. Work packages

Lane owners: **A** = engine/state · **B** = components/a11y · **C** = backend/speech/embed · **D** = design/content.

### W1 · Engine — 7.0 d (A)

**Objective:** `FormState` is the single source of truth and every input is a controlled projection of it. This is what makes act 3 (lossless mode switching) true instead of staged.

```
packages/core/src/engine/
├── state.ts          # FormState, initial state, schemaVersion pinning
├── reducer.ts        # pure; every action enumerated in a discriminated union
├── actions.ts
├── selectors.ts      # visibleSteps, currentFieldGroup, progress, reviewRows
├── validation.ts     # zod on Continue only; values never cleared on error
├── errors.ts         # { fieldId, code, params } → resolved at render, per locale
├── branch.ts         # resolver + normalizeReturnUrl(state, urlStep)
├── prefill.ts        # field | profile | session | constant (WCAG 3.3.7)
├── projection.ts     # grouped ↔ one-per-page; synthetic step ids `dob#2`
├── history.ts        # ?step= sync, Back restores exact state
└── announce.ts       # polite live region, ≥ 1400 ms debounce, never while typing
```

**Acceptance**

```bash
pnpm test --filter @openpath/core           # exit 0, includes the projection invariance test
pnpm test --filter @openpath/core -t projection   # every field id survives a mid-form switch
```

The projection test is the load-bearing one: for the frozen demo schema, enumerate every step, snapshot `values`, switch pacing, assert **deep equality** of `values` and that every field is still reachable. Write it before the UI — it is act 3's contract.

**Cut from P1 engine scope:** `BroadcastChannel` multi-tab, 409 merge, AES-GCM draft encryption, cross-device QR. Rationale: the demo never opens two tabs and never stores real data. All four are P2 (§7.5 of the parent plan: multi-tab *detection* only).

### W2 · Persistence, offline and recovery — 2.0 d (A)

```
packages/core/src/persist/
├── adapter.ts        # put/get/clear; versioned key openpath:draft:<instanceId>
├── autosave.ts       # 1 s debounce + flush on pagehide, visibilitychange, step change
└── quota.ts          # navigator.storage.estimate(); warn under 5 MB, never lose silently
apps/demo/sw.ts       # Workbox: precache shell + tokens + Tier-0 manifest; SWR for schema
```

**Acceptance (act 4 — the act that wins this kind of competition)**

```bash
pnpm test:e2e -- --grep "offline"    # exit 0
```

The Playwright spec must: fill 3 steps → kill the route (`context.setOffline(true)`) → reload → assert 100 % of values restored from IndexedDB with the shell served by the SW → go online → assert the queued PATCH completes **exactly once** (idempotency key asserted). A spec that passes by keeping the page alive is not a test — it must survive a real reload with the network down.

### W3 · Components — 12.5 d Tier A (B, with A on day 1 and C on act 5)

File convention, every component:

```
packages/react/src/components/<Name>/
├── <Name>.tsx
├── <Name>.test.tsx          # logic + ARIA wiring (Testing Library)
├── <Name>.axe.spec.ts       # 3 states × 2 locales × 320 px (Playwright)
├── <Name>.stroppy.tsx       # minimal story — doc page is P2
└── index.ts
```

Export only from `packages/react/src/index.ts` (explicit named exports; `verify:boundaries` enforces it).

**Non-negotiables inside components**
- Never a custom ARIA widget where a native element exists (ADR-001).
- `DateInput`: EC rendered first; year-only is a first-class state (`{precision:'year'}`), **never** fabricate day/month; the verified adapter only — no arithmetic in the component.
- `EthiopianAddressSelector`: native `<select>` at Region/City (14) and Zone; Woreda select **plus** an explicit *"My woreda is not listed"* escape that reveals free text; Kebele + landmark free text. A value outside the dataset is a **soft warning, never a blocking error**. Act 2 must demo the escape, not just the happy path — that is the honest version of the feature.
- `ErrorSummary`: focus lands on the summary container, `<h1>` gets an `Error:` prefix, each entry links to its field, and the wording is generated from the same key as the inline error.

**Acceptance**

```bash
pnpm a11y:audit                 # exit 0: zero violations across the tier-A matrix
pnpm test:targets               # exit 0: every interactive element ≥ 48×48
pnpm count:components           # reports 14 exported; table in the report must match
```

### W4 · Speech — 3.0 d (C + A)

```
packages/speech/src/
├── adapter.ts            # SpeechProviderAdapter (type already exists from P0)
├── tier0.ts              # content-key → Opus lookup; manifest; <audio> with cancel
├── azure-tts.ts          # runtime TTS for user-generated text only
├── addis-asr.ts          # WSS client, 60 s cap, abortable
└── normalize.ts          # digit words, phone digits, homophone fold for MATCH only
apps/server/src/speech/   # WSS proxy (origin allowlist, per-session cap) + POST /tts (hash cache)
scripts/pregen-audio.ts   # batch: content key → Addis Voice 2 → Opus 24 kbps mono → manifest
```

- **Tier 0 first, always.** Every `readAloud.promptKey` on the demo path must have a local Opus file. Runtime Addis Voice 2 is **banned at runtime** (5.4 s p50 — it cannot serve tap-to-hear). Pre-generation is the whole trick: best voice, 0 ms, 0 ETB at runtime.
- **TTS fallback for dynamic text:** Azure am-ET-Ameha, cached by content hash.
- **ASR: name slot only.** Hard cap 120 s/session; server-side daily ceiling; a 429 renders *"voice input is taking a break — you can type or tap instead"*, never a dead end.
- **No transcript is ever written to `values` without explicit confirmation** — that is enforced by the reducer, not by the UI (an action type that cannot carry an unconfirmed transcript).

**Acceptance**

```bash
pnpm speech:verify        # every demo-path promptKey resolves to an Opus file; total ≤ 300 KB
pnpm test:e2e -- --grep "voice"   # reject the transcript → assert values unchanged, no persistence
```

### W5 · Backend — 6.5 d (C)

```
apps/server/src/
├── index.ts              # Fastify 5, Node 22, zod-validated routes
├── routes/{schemas,sessions,submit,tts,consent,help}.ts
├── auth/mock-esignet.ts  # identical PKCE contract to the real thing (ADR-011)
├── demo-policy.ts        # SUBMIT_DESTINATION=discard, 24 h purge, no PII in logs
└── obs.ts                # pino + OTel-lite, PII scrubber (field values never logged)
```

Endpoints are exactly the parent plan's §4.8 list minus uploads and minus live eSignet. **`demo-policy.ts` is not optional** — see §14.

**Acceptance**

```bash
pnpm test --filter @openpath/server   # exit 0
curl -sf $DEMO_ORIGIN/api/v1/schemas/savanna-onboarding-v1 | head -c 200
# 200, ETag present, Cache-Control public, max-age ≥ 300
```

### W6 · Embed channel — 1.0 d (C)

`packages/wc/src/openpath-form.ts` — light DOM (`createRenderRoot(){return this}`), `.op-root` wrapper, `@layer openpath`, attributes `schema-url`, `locale`, `op-theme`. Mount it inside `apps/demo/host-bootstrap/index.html` (the P0 fixture, real Savanna CSS + Bootstrap 5).

**Acceptance (journey J-13)**

```bash
pnpm test:e2e -- --grep "host-bootstrap"   # exit 0
```

Asserts: computed border-radius/padding/font of our controls match the standalone demo (host CSS did not leak in), host page layout unaffected, axe clean, keyboard and focus unchanged, Amharic renders with Noto Sans Ethiopic. A screenshot diff is not enough — assert **computed styles**.

### W7 · Demo app + content wiring — 2.0 d (D + A)

```
apps/demo/src/
├── main.tsx                  # theme switch (default | savanna), locale switch (am | en)
├── views/                    # the six demo-local views (§3.1)
├── content/                  # easy-read blocks, phrase bank, transcript copy
└── act-harness.tsx           # ?act=1..5 deep links so rehearsal is not guesswork
```

- **`?act=N` deep links.** Every act starts from a state you can reach in one URL. Rehearsals are then repeatable and the fallback video matches the live path.
- Content: 5 Easy-Read blocks, **40-chip** phrase bank (am/en), 4 numbered visual instruction cards. All strings through `strings-lint`; no hardcoded Amharic in JSX.
- The demo app is a **consumer** of the library, never a special case: if the demo needs a hack, the hack goes in `apps/demo/src/`, never in `packages/`.

### W8 · AT pass, hardening, deploy — 4.5 d (all, days 8–10)

Manual pass over §5.4 configs **1, 2, 3, 5, 6** (Windows+NVDA+Chrome, NVDA+Firefox, Android 9+TalkBack, keyboard-only, 400 %+320 px). Configs 4, 7, 8 are P2 — record that they were skipped and why. Findings go into `docs/a11y/p1-findings.md` with severity and a fix/no-fix decision each.

---

## 6. Day-by-day lanes

Frozen output = the thing that must exist by end of day, demoable on a phone.

| Day | A — engine | B — components | C — backend/speech/embed | D — design/content | Frozen output |
|---|---|---|---|---|---|
| **1** | reducer + actions + selectors; validation on Continue; keyed error model | `FieldGroup`, `TextInput`, `RadioGroup`, `CheckboxGroup` (A pairs on these) | Fastify skeleton; `GET /schemas/:id` with ETag; staging deploy | Theme applied to demo shell; 10 screen layouts | `pnpm ci` green; 4 inputs axe-clean; schema served over TLS |
| **2** | `ErrorSummary` + `FieldError` wiring; branch resolver; history sync; `?step=` | `ErrorSummary`, `FieldError` polish; `QuestionPage` | `POST /sessions`, `PATCH /sessions/:id` (idempotency); origin allowlist | Error/hint/instruction copy in am+en; 20 screens | Empty submit → summary focused, title prefixed, values intact |
| **3** | prefill resolver; autosave adapter + 1 s debounce; recovery state | `DateInput` (EC/GC, year-only) using the **verified adapter** | Tier-0 pre-generation script; audio cached to CDN; consent log | Address dataset spot-check against 3 real addresses; EC copy review | Enter year-only + EC date; offline reload restores it |
| **4** | `projection.ts` (grouped ↔ one-per-page) + invariance test; announce debounce | `EthiopianAddressSelector` (14 regions, filtered zone/woreda, free-text escape) | `POST /consent`; mock eSignet PKCE | Review-page layout; Amharic error copy review | Act 3's core: switch pacing mid-form, zero loss |
| **5** | review model (`CheckYourAnswers` rows); prefs store | `CheckYourAnswers`; `AccessibilityPreferenceManager`; **mid-sprint usability check** (2 colleagues + 1 external screen-reader user) | Service Worker + Workbox precache; `demo-policy.ts` | Easy-Read blocks 1–5 | Prefs panel changes real tokens; SW precaches shell |
| **6** | `AlternativeResponseComposer` state (no free-text-only path) | `EasyReadRenderer`; `AlternativeResponseComposer` | WSS ASR proxy (**name slot only**), caps, 429 UI | Phrase bank 40 chips (am/en); transcript copy | Act 3 complete: 6-tap answer, editable as text after |
| **7** | Tier B integration: `GuidedQuestion` → `ReadAloudController` | Tier B: `GuidedQuestion`, `ReadAloudController` | TTS proxy + hash cache; rate limits; nightly purge job | Visual instruction cards (4); demo script v1 | Tap-to-hear works offline from Tier 0 |
| **8** | `VoiceInput` + `AnswerConfirmation` wiring (reduce-only path) | Tier B: `VoiceInput`, `AnswerConfirmation`; WC component (W6) | WC build + host-fixture test; deploy hardening; rollback plan | **Backup video recorded** (screen + phone, burned-in captions) | Single `<openpath-form>` works in the Bootstrap host |
| **9** | Bug triage from device pass; fix-only after 14:00 | **Full manual AT pass** (configs 1,2,3,5,6) + fix list | Airplane-mode test on Redmi; perf budgets; `demo-readiness --act=all` | Pitch deck (5 acts, 6 min); QR + Amharic one-pager | `demo-readiness` exit 0; zero axe violations |
| **10** | Fix-only until 12:00 → freeze | OPD walkthrough (U0); top-5 defects recorded | Deploy freeze; key rotation; final wipe check | Rehearse twice on 2 devices; live pitch | **Demo + recorded fallback + `templates/P1-report.md`** |

**Daily ritual (15 min, non-negotiable):** demo the day's frozen output on a phone. If it does not work on a phone, the day is not done, regardless of what the tests say.

---

## 7. The five acts — exact scripts

Six minutes total. Each act has a live path **and** a recorded fallback (§13).

### Act 1 · "It is a real form, done right" — 75 s
Open act 1 (`?act=1`). One question per page. Submit empty on the name step. **Assert on screen:** focus ring on the error summary at the top, `<h1>` now reads *"Error: …"*, every value still there, each summary link jumps to its field, inline error wording identical. Narrate with NVDA running — the point is the announcement order, not the visuals.

### Act 2 · "Ethiopian by construction" — 90 s
Enter a **year-only** Ethiopian birth date (`፲፱፻፹፰` / 1988 EC) — show that month/day were never invented. Then address: Addis Ababa → Bole → **tap "My woreda is not listed"** → type the woreda name. The escape is the demo. Review page shows both calendars side by side.

### Act 3 · "Adaptation with zero loss" — 120 s
Mid-form, open preferences: Easy-Read on, one-thing-per-page on, 2× text, cream surface. Every answer intact. Then symbol/phrase composer: build a work-history sentence in **6 taps**. Close with keyboard-only: Tab, Space, Enter.

### Act 4 · "Airplane mode" — 90 s
Toggle airplane mode **on stage**. Reload. Keep going. Reconnect. Show the recovery banner and the queued sync completing once. Say the number: *"13 answers, one reload, zero network."*

### Act 5 · "Amharic voice, honestly" — 75 s
Tap-to-hear an Amharic prompt — instant, from cache, airplane mode still on if you dare. Turn network back on. Speak a name. Show the transcript, **reject it**, retype. Then say out loud: *"The report's 28.18 % word-error rate on numeric prompts is exactly why nothing is accepted without read-back."*

> **Wording discipline:** the 28.18 % figure is **vendor-reported and not measured by us**. Say it as such. If you have time on day 9, record 30 clips and measure our own error rate — if you do not, do not present an invented number.

### Always have
Recorded video (captions burned in), a second phone, printed QR to the deployed URL, and a hot-spot. Conference Wi-Fi fails.

---

## 8. Descope ladder

### 8.1 Pre-pulled (already assumed in §1's arithmetic)

| # | Cut | Saves | Cost to reverse |
|---|---|---|---|
| L1 | `FileUpload` → plain `<input type="file">` + spoken hint | 0.75 | Low |
| L2 | `SaveAndResume` → `FormRecovery` banner only | 0.5 | Low |
| L3 | ASR 3 slots → **1** (name only) | 1.0 | Low — adapter unchanged |
| L4 | Address: woreda filtered select → free text with 3 suggestions | 0.5 | Low |
| L5 | Easy-Read blocks 8 → **5** | 0.4 | Content only |
| L6 | Phrase bank 60 → **40** chips | 0.4 | Content only |
| L7 | `HumanHelpRequest` → static help link in `QuestionPage` | 0.4 | Trivial |
| | **Total** | **≈ 3.95** | |

### 8.2 Restore in this order if days 1–6 run clean

1. L3 (ASR back to 3 slots) — 1.0 d, biggest demo win
2. L1 (`FileUpload`) — 0.75 d
3. L4 (filtered woreda select) — 0.5 d
4. L2 (`SaveAndResume`) — 0.5 d

### 8.3 If you are behind on day 7 anyway — cut in this order

1. `AlternativeResponseComposer` → phrase chips as read-only suggestions with a "use this" button (**−0.6**)
2. `CheckYourAnswers` → a plain `<dl>` with no edit affordance (**−0.5**)
3. `EasyReadRenderer` → 3 blocks, no illustrations (**−0.3**)
4. Tier B → tap-to-hear only; act 5 becomes read-aloud + typed input (**−3.25**)

### 8.4 Never cut, for any reason
Error summary + focus management · offline autosave + reload recovery · lossless mode switching · EC/GC + year-only dates · one AT-verified path per disability group. **Those five are the product; the rest is surface area.**

---

## 9. Verification gates

| Gate | Command | Pass |
|---|---|---|
| Everything P0 promised still works | `pnpm ci` | exit 0 |
| Calendar untouched and still correct | `pnpm ethiopia:verify` | 60/60, range guard enforced |
| Address dataset + escape path | `pnpm ethiopia:address:verify` | exit 0, soft-warning path covered |
| Tokens, both themes | `pnpm tokens:contrast --theme=all` | exit 0 |
| Schema frozen | `pnpm schema:lint` + hash compare | exit 0, hash unchanged since day 1 |
| Strings complete on the demo path | `pnpm strings:lint --path=demo` | exit 0, no `TODO` |
| Axe matrix | `pnpm a11y:audit` | 0 violations |
| Target sizes | `pnpm test:targets` | exit 0 |
| Journeys | `pnpm test:e2e --grep "J-0(1|2|3|5|7|9|13)"` | exit 0 |
| Offline (act 4) | `pnpm test:e2e -- --grep offline` | exit 0, real reload |
| Host isolation (J-13) | `pnpm test:e2e -- --grep host-bootstrap` | exit 0, computed styles asserted |
| Budgets | `pnpm size` | react ≤ 120 KB, CSS ≤ 22 KB, initial JS ≤ 90 KB, Opus manifest ≤ 300 KB |
| Speech assets | `pnpm speech:verify` | every promptKey resolves |
| Demo policy | `pnpm demo:policy` | `SUBMIT_DESTINATION=discard`, purge scheduled, no PII logging |
| **Readiness** | `pnpm demo:readiness --act=all` | **exit 0** |

---

## 10. `scripts/demo-readiness.ts` — the gate that matters

Run it before every rehearsal and on day 10 before you walk on stage. It is the difference between a rehearsal and a hope.

```bash
pnpm demo:readiness --act=all      # 0 = pass, 1 = hard fail, 2 = warnings only
pnpm demo:readiness --act=5        # per-act, for triage
```

| Check | Severity | Why |
|---|---|---|
| Schema hash matches `schemas/.frozen.sha256` | hard | A live schema change invalidates every rehearsal |
| Every demo-path `readAloud.promptKey` has an Opus file; total ≤ 300 KB; no file > 40 KB | hard | Act 5 without cached audio is a 5.4 s silence |
| `SUBMIT_DESTINATION === "discard"` and `DEMO_MODE === "1"` | **hard** | Prevents a public demo collecting real personal data (§14) |
| Session TTL ≤ 24 h and the purge job is scheduled | hard | Same |
| Both themes pass contrast; tier-A components axe-clean | hard | The pitch's first claim |
| `ethiopia:verify` 60/60 | hard | The pitch's second claim |
| Reachability: `GET /schemas` + WSS handshake, 2 s timeout | **warning** | Never let a network hiccup block a rehearsal you could still run offline |
| `human_signoff` on the calendar vectors | warning | Demo may proceed with `pending`; **shipping may not** — say so in the report |
| Devices charged & enumerated (manual checkbox in `ops/demo-checklist.csv`) | warning | Humans lie about this one |

---

## 11. What not to fabricate

The agent must not invent, estimate, or "round" any of these.

| Thing | Truth |
|---|---|
| Calendar conversion | Use the P0 adapter. 60 vectors, 2,399-date sweep. **Never** hand-roll or "simplify" EC arithmetic |
| Sept 11 vs 12 | Follows the **Ethiopian** leap year (EC ≡ 3 mod 4). 2023-09-12, 2026-09-11, 2027-09-12 |
| Region count | **14** (12 regional states + Addis Ababa + Dire Dawa). Not 11, not 13 |
| ISO 3166-2 codes | Do **not** invent one for Central Ethiopia or South Ethiopia — they are unallocated |
| WER | 28.18 % is the *report's vendor-reported* figure on numeric prompts. Label it. Do not present it as our measurement |
| Latency | Azure TTS p50 ≈ 1.05 s; Addis Voice 2 p50 ≈ 5.40 s (why it is build-time only); Addis Scribe TTFW ≈ 1.56 s, finalisation ≈ 30 ms. **30 ms is not first-word latency** |
| Contrast | Use the computed values in `phases/assets/savanna-theme-contrast.md`. Do not re-eyeball brand colours |
| WCAG 1.2.6 | **AAA.** Its absence is not a conformance failure and must not be described as one |
| EthSL | Out of v1.0. Do not add a placeholder video, a "coming soon" toggle, or a disabled button |
| Speech pricing | Do not quote `$0.016/min`; it contradicts the published 5 ETB/min |
| User research | If U0 did not happen, write `NOT RUN`. Colleagues are not participants |

---

## 12. Guardrails — do not do these

1. **No `!important` theming, no Shadow DOM, no accessibility overlay.** ADRs 007/009/014. A "quick fix" that breaks J-13 costs more than the feature it fixes.
2. **No XState, no form library** (React Hook Form, Formik). The reducer is the product (ADR-002).
3. **No custom ARIA widget where a native element exists** (ADR-001). No `role="button"` on a `div`, no fake `<select>`.
4. **No runtime call to Addis Voice 2.** Pre-generate (ADR-005).
5. **No ASR value without explicit confirmation** — enforce it in the action type, not the button.
6. **No real personal data.** Not in fixtures, not in screenshots, not from judges' documents. Uploads during the demo use a prepared sample file.
7. **No `TODO`/`Lorem ipsum`/placeholder strings** on the demo path — `strings:lint --path=demo` must be clean.
8. **No weakening of a test to make a day land.** If a test is wrong, fix the test in a separate commit with a reason; delete nothing silently.
9. **No editing `node_modules`, no patching the calendar library.** The range guard exists because the reference library has a known defect.
10. **No production claim.** Everything in the demo is labelled pre-release; the report says `human_signoff: pending` where true.
11. **No feature without a demo moment** (parent §7.1). If it is not on the five acts' path and not on the ladder, it is P2.
12. **Do not commit `.host-fixtures/`, recordings, or API keys.** `.gitignore` already covers the first two; check the third before every push.

---

## 13. Demo operations

| Concern | Plan |
|---|---|
| Hosting | Ethiopian-hosted box + TLS (ADR-004). **Demo exception:** if no ET region is available by day 6, deploy to the nearest region, document the deviation in the report, and do **not** describe it as the production topology |
| Demo policy | `DEMO_MODE=1`, `SUBMIT_DESTINATION=discard`, 24 h session TTL, nightly purge, on-screen banner *"Demo instance — do not enter real personal information"*, `noindex` + `robots.txt` |
| Data | Fake seeded profile for prefill demos; submissions counted and discarded, never stored as records |
| Access | Rate limits on all endpoints; ASR cap 120 s/session; TTS cap 90 s/session |
| Wi-Fi | Phone A on conference Wi-Fi, phone B on a hotspot. Acts 1–4 must work with **zero** network (that is act 4's whole point) |
| Keys | Rotated after the event; delete console apps for the demo tenant |
| Rollback | Tag `p1-demo-frozen`; redeploy = `git checkout p1-demo-frozen && pnpm deploy` |
| Fallback | 6-minute video with **burned-in captions** (1.2.2 applies to our own pitch), recorded day 8, re-recorded only if acts change |
| Pitch accessibility | Amharic one-pager QR for the audience; spoken narration + captions; no information conveyed by colour alone in the deck |

---

## 14. Exit criteria — checkpoint table

| # | Checkpoint | Command / evidence | Fails if |
|---|---|---|---|
| 1 | P0 intact | `pnpm ci` | anything pre-existing breaks |
| 2 | Engine projection invariance | `pnpm test --filter @openpath/core -t projection` | any value lost on pacing switch |
| 3 | Offline + reload | `pnpm test:e2e -- --grep offline` | values restored only without a reload |
| 4 | Error contract | `pnpm test:e2e -- --grep "empty-submit"` | focus not on summary, or wording differs |
| 5 | Host isolation | `pnpm test:e2e -- --grep host-bootstrap` | computed styles differ from standalone |
| 6 | Tier A complete | `pnpm count:components` | fewer than 14 exported (Tier B, if built, is 15–18 and must be reported separately) |
| 7 | Axe | `pnpm a11y:audit` | any violation |
| 8 | Budgets | `pnpm size` | any artifact over budget |
| 9 | Speech assets | `pnpm speech:verify` | missing Tier-0 file on demo path |
| 10 | **Readiness** | `pnpm demo:readiness --act=all` | exit ≠ 0 |
| 11 | Manual AT | `docs/a11y/p1-findings.md`, configs 1/2/3/5/6, two signatories | any untriaged severity-1 |
| 12 | Acts | 5/5 pass twice on device, once witnessed by a non-builder | any act staged or replayed from video unnoticed |
| 13 | U0 | `docs/research/u0-notes.md` with top-5 defects | `NOT RUN` without a stated reason |
| 14 | Policy | `pnpm demo:policy` | demo can store real data |

---

## 15. Handoff report — `templates/P1-report.md`

The agent fills this in on day 10. Copy the structure; do not free-form it.

```
## 1. Status
Shipped / partially shipped / blocked — with the act status of all five.
## 2. Components
Table: component | tier | DoD tier met | deferred items. Must match `pnpm count:components`.
## 3. Verification transcript
Paste raw output + exit codes for gates 1–14. No summaries of unrun commands.
## 4. Acts
Per act: live-passed (how many times, which device), or degraded how.
## 5. Descope ledger
Every ladder item pulled, with its eng-days, and which work it displaced.
## 6. Deviations from spec
Including any hosting deviation from ADR-004.
## 7. Blocked items
Gate failures with the exact command that shows the block.
## 8. Costs incurred
Speech minutes, hosting, compensation — against `ops/budget.csv`.
## 9. U0 findings
Top 5 defects, severity, and whether each is a defect or a preference.
## 10. What P2 inherits
Deferred DoD (HARD-01…06), Tier B/C status, and the four components that did not ship.
## 11. What we would cut first if we did this again
One honest paragraph. Judges and future engineers both read it.
```

---

## 16. What P2 inherits

| Item | Est. |
|---|---|
| Deferred sprint DoD (`HARD-01`…`HARD-06`) across 14 components | **≈ 7.5 d** |
| Tier C components (4) + any Tier B that did not land | **≈ 2.4–5.7 d** |
| Demo-local views promoted to components (only if U0 justifies) | 0–2 d |
| Engine items cut from P1 (multi-tab, 409 merge, encryption at rest, QR) | **≈ 3.0 d** |
| Full AT configs 4, 7, 8 | 1.0 d |
| **Total added to P2** | **≈ 12–15 d** |

The parent plan's 84-day buffer (27 %) absorbs this without moving the v1.0 date. **P2 must start by re-deriving the component registry from `pnpm count:components`**, not from this document — the numbers here are the plan, the registry is the truth.

---

## Appendix A — The 15-day variant (if the window is negotiable)

Required work is ~39.6 eng-days; with the designer building the demo shell, capacity is ~28 productive days in a 10-day window. Fifteen working days gives 45 gross / **36 productive** for the three engineers alone — which fits with the ladder **not** pulled and no designer coding:

- All 18 components at sprint DoD (restores `FileUpload`, `SaveAndResume`, `PhoneInput`, `HumanHelpRequest`)
- ASR on 3 slots (name, phone, enum)
- Full 60-chip phrase bank, 8 Easy-Read blocks
- All 8 AT configs instead of 5
- A rehearsal day where nothing is being built

**Cost of insisting on 10 days:** the Tier C components and ~4 eng-days of polish, which reappear in P2 as ~6 days (the gap between "hackathon grade" and "hardened" is not linear). Recommend 15 days to whoever controls the calendar; plan for 10 and pull §8.1 on day 1.
