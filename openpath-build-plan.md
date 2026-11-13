# OpenPath — Realistic Build Plan

> **⚠️ Not the document you need this weekend.** For the Digital Bridge hackathon (14–15 Nov, track 1) use [`hackathon-2day.md`](hackathon-2day.md). This plan is the 26-week horizon for *if the module wins the paid hardening sprint* — its scope (42 components, WCAG-EM evidence, 6-region trials) is 10× what a 12-hour build can carry. Kept because P0's verified calendar adapter, the audited Savanna theme and the cut ledger remain valid inputs *if* you win.

**From the *OpenPath Research and Architecture Report* (72 pp.) to shipped software**

| | |
|---|---|
| **Version** | 1.2 — 13 November 2026 · v1.1 cut EthSL + 5 components; v1.2 replaces the hand-rolled calendar with a verified library and drops the bundled address cascader (§4.9) |
| **Source document** | `openpath1.pdf` — *OpenPath Research and Architecture Report: Designing an Adaptive, Low-Bandwidth Accessible Onboarding and Form-Completion System for Ethiopia* |
| **Target** | Savanna learner + job-seeker onboarding, embeddable by third-party institutions |
| **Team assumed** | 3 engineers (2 strong frontend/TS, 1 full-stack/backend) + 1 product designer, plus a fractional Amharic editor and accessibility auditor |
| **Horizons** | Phase 0: 10-day hackathon sprint → Phase 1–5: production v1.0 in 26 weeks |
| **Standards** | WCAG 2.2 AA (with 48 px targets), W3C COGA, ARIA APG |
| **Compliance** | Personal Data Protection Proclamation No. 1321/2024 (Ethiopia) |

**Contents:** [0 TL;DR](#0-tldr) · [1 Assumptions](#1-assumptions-and-how-to-read-this-plan) · [2 Verdict on the report](#2-verdict-on-the-source-report) · [3 Scope](#3-scope) · [4 Architecture](#4-architecture) · [5 Accessibility standard](#5-accessibility-engineering-standard-the-contract) · [6 Content & localization](#6-content-and-localization-workstream-the-real-critical-path) · [7 Hackathon sprint](#7-phase-0--the-10-day-hackathon-sprint) · [8 Production roadmap](#8-phase-15--production-v10-in-26-weeks) · [9 Testing & research](#9-testing-qa-and-research-plan) · [10 Risks](#10-risk-register) · [11 Success criteria](#11-success-criteria) · [12 Budget](#12-budget) · [13 Governance](#13-governance-and-engineering-process) · [14 Legal & compliance](#14-legal-ethics-and-compliance-workstream) · [15 First 48 hours](#15-first-48-hours-concrete) · [Appendices](#appendix-a--question-protocol-run-before-building-any-schema)

---

## 0. TL;DR

**What we are building.** A schema-driven, offline-first form engine that renders one canonical JSON schema into three presentation modes (grouped sections, one-thing-per-page, Easy-Read) plus a phrase-bank response composer, all over native HTML; distributed three ways in v1.0 (React npm package, Light-DOM web component, REST API — the `<script>` bundle follows in v1.1); with a pre-generated-first Ethiopian speech stack that degrades to zero-API offline audio; and Ethiopian domain primitives (EC/GC dual calendar, patronymic names, Region→Zone→Woreda→Kebele addresses, FCN/witness identity).

**The three things that decide success.** (1) The **adaptive rendering engine** — one state tree, many projections, zero data loss on switch. (2) The **offline + interrupted-session story** — because power cuts and data drops are the dominant failure mode (target: 100% of the core flow completable offline). (3) **Amharic content quality** — the long pole, not the code.

**The report is a strong research document and a poor plan.** It specifies 42 components, 5 delivery stages, a full speech stack and a 10-day build — that is roughly **50–60 engineer-days in the hackathon window alone (~2× capacity)** and **~300 eng-days to build all 42 components at the depth the report specifies**. This plan keeps the research, cuts the scope to what ships, and states what gets deferred.

**v1.1 of this plan cuts harder than v1.0 did.** Sign language (EthSL) is out of v1.0, along with five costly or unvalidated components; two dependencies we do not control (live Fayda eSignet, ENAD video production) are off the critical path entirely; and an arithmetic error in the previous draft is corrected (§3.2). Net effect: **284 → 241 eng-days**, turning a 9 % margin into a **23 %** one. §3.5 records every cut, its rationale, and its cost to reverse.

**Five corrections that change the build** (detail in §2.2):

1. **Addis Voice 2 is not the low-latency tier.** Published p50 latency is **5.40 s** vs Azure Ameha at **1.05 s**. The report's tiering is inverted for interactive use.
2. **Addis Voice 2 costs ~2× what the report budgets** — 5 ETB/min of audio (≈300 ETB/hr), not 150 ETB/hr. Its 50% promo ended 12 Nov 2026.
3. **Ethiopia's data law mandates local storage of locally collected personal data** (Proclamation 1321/2024, Art. 22). The report's architecture is silent on data residency and assumes a global cloud proxy for speech. This is an architecture-level constraint, not a footnote.
4. **`CSS @scope` cannot be the isolation strategy** — support is absent on the old Android WebViews that dominate the target device class. Isolation must be `.op-root` class-prefixing + `@layer`, with `@scope` as a progressive enhancement.
5. **ARASAAC symbols are CC BY-NC-SA** (non-commercial). A commercial Savanna deployment needs Mulberry / Open Symbols or written permission. The report lists both as interchangeable.

**Cost of the production phase, excluding salaries:** roughly **$7.5k–12.5k cash** (vendors, hosting, studio recording, participant compensation, external audit) plus $250–600/month steady-state infrastructure and speech spend at pilot volume. §12 breaks this down.

**Highest-impact risks:** data residency compliance (R1), Amharic content bottleneck (R3), Deaf-user comprehension now that signing is out of scope (R4, accepted residual), and ASR at 28% WER being mistaken for a text-entry replacement (R2).

---

## 1. Assumptions and how to read this plan

### 1.1 Assumptions

| Assumption | Value used | If wrong |
|---|---|---|
| Hackathon | 10 consecutive working days, demo on day 10 | Compress via §7.6 descope ladder |
| Team availability | 3 engineers @ 6 effective hours/day; designer full-time | Solo/2-dev variant in §8.7 |
| Production horizon | 26 weeks (13 × 2-week sprints) | 20 weeks only with §8.6 deferral list applied |
| Amharic capability | 1 native Amharic speaker on team + 1 contracted editor | Blocking: hire before Phase 1 (R3) |
| EthSL capability | **None in v1.0** — signing is cut (§3.5) | Ship captions + numbered visual instruction cards; revisit only if U1 shows comprehension failure |
| Network environment | 2G/3G, 200–800 ms RTT, frequent loss | Perf budgets in §9.1 already conservative |
| Device floor | Android 8.0, 2 GB RAM, 5" 720p, Chrome/WebView | Raise floor and document it |
| Savanna API | Not yet available → mock host portal | Adapter layer (§4.8.4) absorbs the swap |
| Currency | ≈150 ETB / USD (confirm at cost time) | Re-price vendor lines |

### 1.2 Conventions

- **Estimate units:** *eng-day* = 1 engineer, ~6 productive hours. Every estimate includes unit + a11y tests and docs, excludes review latency.
- **Milestones (M0–M6)** are hard gates with exit criteria (§8.2). Slipping a milestone triggers the deferral list, never silent scope growth.
- **"Done"** always means: axe-clean across default/error/conditional/320 px states, keyboard-complete, screen-reader verified on the named AT, 400% zoom reflow, forced-colors checked, unit + contract tests, Storybook story, docs entry.
- **Sources:** every externally sourced number carries a verification status (§2.3). Unverified numbers must not appear in a pitch deck.

---

## 2. Verdict on the source report

### 2.1 Adopt wholesale (this is the good half)

| # | Finding | Why it survives into the build |
|---|---|---|
| 1 | Native HTML over custom ARIA widgets | Confirmed by GOV.UK/NHS/VA behaviour and by the GOV.UK `aria-expanded`-on-radio failure; also the cheapest thing to test |
| 2 | Decouple canonical form state from presentation | This is the whole product thesis and it is correct |
| 3 | Light DOM over Shadow DOM for embeds | Shadow boundaries silently break `aria-labelledby`/`<label for>` on the device class we target. Non-negotiable |
| 4 | Error summary + `Error: ` title prefix + focus move + identical wording inline | Highest-value, lowest-cost a11y pattern in the entire report |
| 5 | 1 s debounced dual-layer autosave + `normalizeReturnUrl` | Directly addresses the dominant real-world failure (interruption) |
| 6 | Capability-based preference labels, never diagnostic labels | Correct ethically and technically; also avoids mutually exclusive "modes" |
| 7 | 48×48 px targets, 2.4.11 scroll-margin, 3.2.6 consistent help, 3.3.7 redundant entry, 3.3.8 passwordless | The six WCAG 2.2 criteria that actually bite in forms |
| 8 | Reject OpenDyslexic as default; offer spacing/size/tint controls instead | Evidence-aligned and cheaper |
| 9 | Never depend on a cloud AI API for baseline accessibility | Tier-0 pre-recorded Opus as the floor is the right call |
| 10 | Mandatory read-back confirmation for ASR (`<AnswerConfirmation>`) | With 28% WER, this is the only thing that makes voice input safe for official records |

### 2.2 Correct or reject (what the report gets wrong)

| # | Report says | Reality | Decision |
|---|---|---|---|
| C1 | Azure `am-ET-AmehaNeural` = 1.05 s median (fast) — used as "fast fallback" | Confirmed 1.05 s p50 | **Make Azure the interactive TTS default** |
| C2 | Addis Voice 2 = best quality, implied usable for dynamic read-aloud | 4.25/5 blind-listening composite (confirmed) but **p50 latency 5.40 s** | Use Addis Voice 2 for **pre-generated / cached** read-back and samples, not for tap-to-hear on a 3G link. Route **tap-to-hear → Tier 0 Opus cache → Azure → Addis Voice 2** |
| C3 | Addis Voice 2 ≈ $0.016/min or 150 ETB/hr | Published **5 ETB/min of audio** (promo 2.5 ETB ended 12 Nov 2026) ⇒ ≈300 ETB/hr; ASR **3.5 ETB/1k chars** and **5 ETB/min audio** | Budget at list price; add hard per-session speech caps (§12.3) |
| C4 | Architecture is residency-neutral; speech proxied through one backend | **PDPP 1321/2024 Art. 22** requires locally collected personal data to be stored on servers in Ethiopia; cross-border transfer needs comparable protection | Primary datastore **inside Ethiopia**; no PII or raw audio in vendor logs; cross-border only for non-PII or with explicit consent + safeguards (ADR-004) |
| C5 | Isolate embeds with CSS `@scope` + `@layer` | `@scope` is unsupported on the Android 8–12 WebView floor | `.op-root` class scoping + `@layer openpath` as the guarantee; `@scope` behind `@supports` (ADR-009) |
| C6 | ARASAAC / Mulberry interchangeable | ARASAAC = CC BY-NC-SA (non-commercial); Mulberry = CC BY-SA | Default Mulberry + Open Symbols; ARASAAC only with written permission (R12) |
| C7 | 42-component catalogue, 18 essential, 10-day build | 42 components ≈ 120–150 eng-days of *hardened* work; the 10-day plan is ~2× capacity | 18 → hackathon, **28 → v1.0**, 42 → v1.2 roadmap (§3.2) |
| C8 | Six-month pilot scope bundled into "Stage 4" | Field trials, self-hosted GPU inference and full EthSL library are separate funded workstreams | Explicitly out of v1.0; separately costed (§12.5) |
| C9 | Implied "WCAG AA + axe-clean = accessible" | axe-core catches ~57% of issues by volume | Manual AT script is a release gate, not a nice-to-have (§9.3) |
| C10 | Ethiopian Sign Language video as a standard onboarding feature | **WCAG 1.2.6 (Sign Language, prerecorded) is Level AAA, not AA** — it is not required at our stated bar, and clip production is a 3-week external dependency | **Cut from v1.0.** Captions + visual instruction cards instead; schema slot reserved; revisited only on user evidence (§3.5) |

### 2.3 Verification ledger (checked 13 Nov 2026)

| Claim | Status | Note for use in public material |
|---|---|---|
| WebAIM SR Survey #11 (Jul–Aug 2026, n=1,780); NVDA 83% primary in Africa/ME | **Verified** | Safe to cite [webaim.org/projects/screenreadersurvey11](https://webaim.org/projects/screenreadersurvey11/) |
| Addis Voice 2: 4.25/5 listening composite, 13.87% WER, 28.18% numeric-prompt WER, **5.40 s p50** | **Verified** | Cite addisassistant.com/benchmarks/addis-voice-2-amharic; note the numeric-prompt weakness explicitly |
| ElevenLabs v3: 147.86% WER on Amharic | **Verified** | Safe, with the caveat that it is an ASR-judge proxy |
| Addis Scribe Streaming: 28.4% WER (WAXAL), 30 ms finalisation; open weights published | **Verified** | The open weights materially change the post-hackathon self-host option — it is *more* feasible than the report implies |
| Azure Ameha Neural p50 1.05 s; $15 / 1M chars neural TTS | **Verified** | Budget line in §12 |
| axe-core ≈57% detection; Lighthouse 30–40% | Plausible, widely cited | Keep, but attribute to Deque's 2021 study rather than stating as current |
| Lazar et al. 2007 (30.4% of browsing time lost) | Plausible, not re-checked here | Fine for narrative, not for a KPI target |
| Ethiopian New Year 2026 = Meskerem 1, 2019 | **Resolved 13 Nov 2026** — two independent libraries agree (2,399/2,399 sampled dates, 1900–2100); `2026-09-11` confirmed | Cite the fixture, not a blog: `phases/assets/ec-gc.vectors.csv` |
| Proclamation 1321/2024 in force, ECA is regulator, no implementing directives yet | **Verified** | Cite statute text, not directives (they do not exist yet) |

> **Rule:** before any hackathon slide or investor deck, every figure above marked *plausible* or *contested* gets 10 minutes of re-verification or is removed. False precision on Ethiopian language benchmarks is the fastest way to lose a technical judge.

---

## 3. Scope

### 3.1 Product shape

```
                          ┌──────────────────────────────────────────┐
   Savanna React app ────►│  @openpath/react   (37 components, v1.0)  │
   Legacy employer page ─►│  @openpath/wc      <openpath-form>        │──► canonical
   Any HTML template ────►│  @openpath/standalone  iife.js (v1.1)     │    JSON output
   Partner backend ──────►│  @openpath/server  REST + WSS             │
                          └──────────────────────────────────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        │  @openpath/core               │  schema · branching · validation
                        │  @openpath/ethiopia           │  EC/GC · addresses · names · fidel
                        │  @openpath/speech             │  4-tier adapters
                        └───────────────────────────────┘
```

### 3.2 Component count by release

The report catalogues 42 components in three families: **13 basic inputs, 14 structural/workflow, 15 specialised accessibility**. Shipping all 42 to the §5.2 contract is ~300 eng-days — more than a 3-engineer year before content, testing or audit. So:

| Release | Shipped | Contents |
|---|---|---|
| **v0.9 (hackathon)** | **18** | MultiStepForm, QuestionPage, ErrorSummary, FieldError, FieldGroup, TextInput, PhoneInput, RadioGroup, CheckboxGroup, DateInput (EC/GC + year-only), EthiopianAddressSelector, CheckYourAnswers, AccessibilityPreferenceManager, GuidedQuestion, ReadAloudController, VoiceInput, AnswerConfirmation, HumanHelpRequest |
| **v1.0 (production)** | **36 of 42** | All 14 structural; 11 of 13 basic inputs; 11 of 15 specialised. Adds: FormFieldWrapper, FieldInstructions, EmailInput, NumberInput, Textarea, Select, PasswordInput, FileUpload, ProgressIndicator, ConditionalField, FormRecovery, SaveAndResume, AccessibleConfirmationDialog, FocusRecovery, AccessibleNotification, EasyReadRenderer, VisualInstructionRenderer, AlternativeResponseComposer |
| **v1.1 (post-launch)** | **42** | The six deferred: `Autocomplete`, `SearchableSelect`, `SymbolBasedResponse`, `DocumentCaptureAssistant`, `ReadingRuler`, `KeyboardAssistance` |
| **v1.2+ (unscheduled)** | — | Candidates beyond the report's 42 (rich-text consent, signature, time/currency/table inputs, repeatable groups) — built only where user research justifies them |

> **Correction to v1.0 of this plan.** That draft claimed "28 components at v1.0" while listing 17 additions on top of 18 — which is 35, not 28. The count is now generated from the component registry and CI-checked (`pnpm count:components` fails if this table and the registry disagree). Anyone quoting "28" from the earlier draft is quoting a typo.

The five deferred components are the worst effort-to-evidence ratio in the catalogue: three need external production we cannot schedule (sign clips, pictogram curation, device-tuned camera guidance) and two duplicate capability we already have (native `<select>` covers `Autocomplete` for our bounded address lists; `ReadingRuler` and the 4-key keypad have no Ethiopian validation yet).

### 3.3 In / out of v1.0

| In scope | Explicitly out (v1.1+) |
|---|---|
| WCAG 2.2 AA + COGA patterns, 48 px targets | WCAG 3 / APCA contrast model |
| Amharic + English UI, i18n-ready for om/ti | Reviewed Afaan Oromoo + Tigrinya copy |
| EC/GC dual calendar + year-only DOB | Ethiopian time-of-day (12-hour clock offset) |
| Patronymic names; Region/City → Zone → Woreda selects with a free-text escape, Kebele + landmark free text | Live address autocomplete from a government API; kebele code lookup |
| Offline completion + draft recovery + resume link | Cross-device QR state hand-off; multi-device collaborative editing |
| Pre-generated Opus → Azure TTS → browser, all behind confirmation | Runtime Addis Voice 2; full-duplex conversational voice agent |
| Fayda **FCN/QR entry** + identity adapter with mock IdP; 8 document types; witness attestation | **Live eSignet OIDC in production**, the full 33-document matrix, OCR verification |
| Phrase-bank composer + Accommodation Passport (JSON + print-ready HTML) | Pictogram/symbol grid, full AAC board library, camera framing assistant |
| Light-DOM web component + theming API | Standalone IIFE bundle (`OpenPath.mount`); SSR of the embed |
| Vendor ASR behind an adapter | Self-hosted ASR, CPU or GPU (v1.1; weights are open) |
| Captions + transcripts + numbered visual instruction cards | **Ethiopian Sign Language video** (research-gated, v1.1) |
| 6-region field trials | Longitudinal impact study |

### 3.4 Non-goals (state these out loud, early)

1. **OpenPath is not a form builder UI.** Schemas are authored in JSON/TS by engineers; a visual builder is a 2027 conversation.
2. **OpenPath does not adjudicate eligibility or verify claims.** It collects, validates structurally, and confirms.
3. **OpenPath does not replace a screen reader.** It must never speak over NVDA/TalkBack, and read-aloud is opt-in.
4. **OpenPath does not fix upstream content.** If Savanna's legal consent text is bureaucratic, no component fixes that — that is the Amharic editor's job.
5. **No accessibility overlay.** Ever. The report is right that overlays are a trap, and shipping one would contradict the product thesis.
6. **No sign-language video in v1.0.** It is AAA-level, not AA, and needs Deaf-produced content we cannot schedule. Captions and visual instruction cards are the v1.0 answer, revisited only on evidence (§3.5, K1).

### 3.5 v1.0 scope decisions — what was cut, and why

| # | Cut from v1.0 | Why it is not a v1.0 item | Ships instead | Days saved | Cost to reverse |
|---|---|---|---|---|---|
| K1 | **EthSL sign-language video** (12–20 clips) | Requires Deaf-produced, ENAD/AAU-reviewed content — a ~3-week external dependency we do not control — and WCAG 1.2.6 is **AAA**, so it is not required at our bar | Captions + transcripts on every audio prompt; numbered visual instruction cards; text/video-relay help channel | 4 | Low (~4 eng-days; the `GuidedQuestion` slot and schema field are reserved). **Gated on U1 evidence, not on budget** |
| K2 | **`DocumentCaptureAssistant`** (spoken camera framing) | Camera behaviour on Android 8–12 is unpredictable, canvas heuristics need per-device tuning, and it stores ID photos — widening our 1321/2024 retention surface | `<FileUpload>` with document-type picker, example image, and a spoken "hold steady" hint | 7 | Medium (~7 days, mostly device testing) |
| K3 | **`SymbolBasedResponse`** (pictogram grid) | Pictogram curation + licensing + Ethiopian cultural validation (ENAID) is a workstream, not a component; serves a narrower group than the phrase composer | `AlternativeResponseComposer` with phrase chips, named categories, Accommodation Passport | 4 | Medium — curation and licence must land first |
| K4 | **Live Fayda eSignet OIDC** | Sandbox access and an MOU sit outside our control; a blocked external dependency had been on the M4 critical path | Identity **adapter interface** + mock IdP with an identical PKCE contract; production-real FCN/QR entry | 10 | Low technically — gated on the MOU, not on engineering |
| K5 | **QR cross-device state hand-off** | Passphrase-managed local crypto ("I forgot the phrase") buys a support burden for a use case we cannot yet evidence | Local draft recovery + SMS/email resume link | 3 | Low |
| K6 | **Standalone IIFE bundle** (`OpenPath.mount`) | The web component already satisfies "one `<script>` tag on a legacy page"; two build targets doubled CDN and versioning surface | `@openpath/wc` Light-DOM custom element | 3 | Low |
| K7 | **Runtime Addis Voice 2 + 6 ASR slots** | 5.4 s p50 latency makes it unusable for tap-to-hear; nearly all its value is captured by pre-generating at build time | Build-time generation (best voice, zero runtime cost) + Azure for user-generated text; ASR on **3** slot-typed fields | 5 | Trivial — the adapter already exists |
| K8 | **33-document matrix, multi-tab merge, `Autocomplete`, `ReadingRuler`, 4-key keypad** | Configuration breadth and unvalidated features | 8 document types; multi-tab **detection** not merge; native `<select>` for bounded lists | 7 | Low |
| | | | | **43** | 284 → **241 eng-days** |

**What was deliberately *not* cut, and why**

- **The adaptive engine (mode switching with zero data loss)** — the product thesis. Without it OpenPath is a competent form library with no reason to exist.
- **Offline-first + interrupted-session recovery** — the dominant real-world failure mode in the target context.
- **Error summary, focus management, native semantics** — the cheapest high-impact accessibility work in the whole catalogue.
- **EC/GC dual calendar, year-only dates, patronymic names, address hierarchy** — what makes this Ethiopian rather than translated.
- **The speech stack (pre-generated Opus + Azure + ASR with mandatory confirmation)** — flagship #2, and now *cheaper*, because pre-generation replaced runtime streaming.
- **The phrase composer** — flagship #3, in reduced form.

**Standing rule:** any addition to v1.0 must name the row it displaces in this table. The table is the scope boundary, not a wish list.

---

## 4. Architecture

### 4.1 Monorepo layout

```
openpath/
├── apps/
│   ├── demo/                  # Savanna mock host: React dashboard + legacy employer page
│   ├── docs/                  # Storybook + a11y docs site + component contract pages
│   └── server/                # @openpath/server (Fastify)
├── packages/
│   ├── core/                  # schema, runtime, validation, persistence, preferences
│   │   ├── src/schema/        # zod definitions + JSON Schema export + migrations
│   │   ├── src/engine/        # reducer, step router, branch resolver, prefill resolver
│   │   ├── src/store/         # IndexedDB adapter, autosave controller, sync queue
│   │   └── src/a11y/          # announcer, focus recovery, id-linker, debounce
│   ├── ethiopia/              # EC/GC, address datasets, names, phone, fidel, collation
│   ├── speech/                # TTS/ASR adapters, tier router, opus cache, caps
│   ├── react/                 # 37 components + tokens (CSS custom properties)
│   ├── wc/                    # <openpath-form> custom element (Preact)
│   ├── standalone/            # openpath.iife.js + OpenPath.mount()  (v1.1 — not built in v1.0)
│   └── testing/               # Playwright fixtures, axe rules, a11y harness
├── content/                   # strings (am/en), easy-read blocks, opus manifest, transcripts
├── schemas/                   # savanna-onboarding-v1.json, savanna-job-app-v1.json
└── infra/                     # Terraform/Compose for ET region, CDN config, CI
```

**Tooling:** pnpm workspaces + Turborepo, TypeScript 5.x project references, `tsup`/`vite` for builds, Vitest for unit, Playwright for e2e + a11y, Changesets for versioning, ESLint + Prettier + `eslint-plugin-jsx-a11y`, `size-limit` for bundle budgets, Storybook 8 with `@storybook/addon-a11y`.

**Hard build rules:**
- `@openpath/core` and `@openpath/ethiopia` have **zero React/DOM dependencies** (pure TS) — they are testable in Node and reusable by the server.
- `@openpath/react` may **not** import from `apps/*`.
- No component may ship a class-less `<div role="...">` widget where a native element exists (lint rule + review).
- Every package exports ESM + CJS + types; browsers get ESM.

### 4.2 Canonical schema

One schema drives state, validation, branching, a11y wiring, content, and speech. Version it and migrate.

```ts
// packages/core/src/schema/types.ts (abridged)
export interface OpenPathSchema {
  id: string;                     // "savanna-onboarding-v1"
  version: string;                // semver; stored with every draft
  locales: Locale[];              // ["am-ET","en-US"]
  defaultLocale: Locale;
  calendar: { default: 'EC' | 'GC'; allowToggle: boolean };
  chapters: Chapter[];            // 1..5 — the unit of progress display
  settings: {
    pacing: 'grouped' | 'one-per-page' | 'adaptive';
    autosaveMs: number;           // 1000
    helpChannels: HelpChannel[];  // WCAG 3.2.6 — identical on every step
  };
}

export interface Chapter { id: string; title: LocalizedText; steps: Step[]; }

export type Step =
  | { kind: 'question'; id: string; fields: Field[]; legend?: LocalizedText;
      headingAs: 'h1'; singleQuestionHeading?: boolean }
  | { kind: 'filter'; id: string; field: Field; routes: Record<string, string> } // branching
  | { kind: 'review'; id: string }
  | { kind: 'statement'; id: string; blocks: ContentBlock[] };

export interface Field {
  id: string;                       // stable; appears in DOM ids, IndexedDB keys, telemetry
  type: FieldType;                  // text|email|tel|number|textarea|select|radio|checkbox|
                                    // date-ec-gc|address-et|name-et|file|symbol-composer|...
  label: LocalizedText;
  hint?: LocalizedText;             // ONE short sentence, no links (aria-describedby)
  instructions?: LocalizedText;     // rich "Why we ask this" — rendered ABOVE the label
  optional?: boolean;               // mark "(optional)", never asterisks for required
  validation?: ValidationRule[];    // zod-backed, message-keyed, locale-resolved
  prefill?: PrefillSource;          // WCAG 3.3.7
  readAloud?: { promptKey?: string; prerecordedOpus?: string };
  ethsl?: { clipId?: string };   // RESERVED for v1.1 — no clips ship in v1.0
  easyRead?: { blockId?: string; symbolIds?: string[] };
  conditional?: { when: Condition; mode: 'inline-single' | 'next-page' };
  pii: 'none' | 'personal' | 'sensitive';  // drives logging, encryption, retention
}

export type PrefillSource =
  | { from: 'field'; fieldId: string }              // earlier answer
  | { from: 'profile'; key: string }                // Savanna account
  | { from: 'session'; key: string }                // e.g. verified phone from OTP
  | { from: 'constant'; value: unknown };
```

**Schema rules enforced in CI** (`schema-lint`):
- Every `pii !== 'none'` field must declare `readAloud` or an explicit `noAudioReason`.
- Every `radio`/`checkbox` group must have `legend`.
- `hint` may not exceed one sentence, 90 characters, or contain a link (fails on `http`, `። ፣`, `—`).
- Every `conditional` trigger must resolve to a step or field that exists in the same chapter graph (no dangling routes).
- Every user-visible string must exist in both `am` and `en` (CI fails on missing keys).
- Every field must appear in exactly one `review` chapter or be flagged `hideInReview` with a reason.

### 4.3 Engine and state

```
 user input ──► dispatch(Action) ──► reducer (pure) ──► FormState ──► projection ──► view
                                        │
                                        ├─► validation (zod, on Continue + on submit)
                                        ├─► prefillResolver (Redundant Entry)
                                        ├─► branchResolver (visible steps, normalizeReturnUrl)
                                        └─► autosaveController (1 s debounce → IndexedDB → sync queue)
```

`FormState` is the **single source of truth**: `{ schemaVersion, instanceId, currentStepId, values: Record<fieldId, unknown>, touched, errors, prefs, meta }`. Every input component is a *controlled projection* of it — that is what makes mode-switching lossless (§4.5).

**Engine decisions:**
- **No XState.** A typed reducer + helper selectors is ~400 LOC, fully serialisable, and avoids a 15 KB dependency. Revisit only if we adopt parallel "task list" forms.
- **Validation timing:** on `Continue` (step level) and on final submit. Never while typing, except (a) debounced non-blocking format hints after blur, (b) an explicit "check my answer" affordance. Values are **never cleared** on error.
- **Errors are keyed, not stringified:** `{ fieldId, code, params }` resolved per locale at render time, so error wording stays identical between summary and inline (WCAG 3.3.1/3.3.3) and survives language switching mid-form.
- **Keyboard/URL sync:** each step is a history entry (`?step=dob`); browser Back works and restores exact prior state. `normalizeReturnUrl(state, urlStep)` runs on every load: if `urlStep` is no longer reachable under current answers, redirect to the nearest preceding visible step and announce it politely.

### 4.4 Persistence, offline and recovery

| Concern | Design |
|---|---|
| Write path | `values` diff → 1 s debounce → `idb.put('drafts', {instanceId, schemaVersion, values, stepId, updatedAt})` → enqueue sync op. Immediate flush on `pagehide`, `visibilitychange`, `SaveAndResume`, and step transition |
| Multi-tab | `BroadcastChannel('openpath:<instanceId>')`; last-writer-wins per field with a visible "this form was updated in another tab" notice |
| Storage pressure | Quota check via `navigator.storage.estimate()`; if < 5 MB free, warn and offer encrypted export before continuing. Never silently lose a draft |
| Encryption at rest | AES-GCM via WebCrypto with a per-install key in IndexedDB (non-extractable) for the local draft. **Honest limitation:** this protects against casual device inspection, not against a determined attacker with the unlocked device — say so in the privacy notice |
| QR hand-off **(v1.1 — designed, not built in v1.0)** | Encrypted, compressed draft (`lz-string` + AES-GCM with a 4-word passphrase shown to the user) encoded as a QR / `.openpath` file. Passphrase-based, never server-key-based, because the second device has no key. v1.0 ships the resume link instead (§3.5, K5) |
| Server sync | `PATCH /sessions/:id` with `If-Match: <rev>`; 409 → client fetches, merges per-field by `updatedAt`, surfaces conflict only for fields changed on both sides |
| Service worker | Workbox; precache shell + tokens + Tier-0 Opus manifest; stale-while-revalidate for schemas; **never** cache API responses containing PII |
| Recovery UX | `<FormRecovery>` banner: *"You have a saved registration from 12 Nov, 3:14 pm at Step 3 of 12. Continue where you left off, or start a new form."* Two explicit buttons, no auto-resume, no auto-submit |

### 4.5 Adaptive presentation (the differentiator)

Preferences are **orthogonal**, not modes. Everything is a CSS custom property + an optional slot:

```ts
export interface OpenPathPreferenceProfile {   // < 1 KB, JSON, portable
  v: 1;
  fontScale: 1 | 1.25 | 1.5 | 2;              // 1.5 ≈ 18 pt
  textSpacing: 'standard' | 'expanded';       // WCAG 1.4.12 + Zorzi et al.
  surface: 'light' | 'cream' | 'dark' | 'yellow-on-black';
  pacing: 'grouped' | 'one-per-page';
  audio: 'off' | 'tap' | 'auto';              // auto cancels on any keypress
  // ethsl: 'off' | 'on';  // reserved (v1.1) — absent from v1.0 profiles
  easyRead: boolean;
  responseModality: 'standard' | 'voice' | 'symbols';
  assisted: boolean;                          // co-completion with a helper
  ruler?: boolean;
}
```

- **CSS layer order:** `@layer openpath.tokens, openpath.base, openpath.components, openpath.utilities;` — institutional theme goes in `openpath.tokens` only, and a **contrast validator runs at build time** over brand tokens (fails the build if any text/UI pair drops below 4.5:1 / 3:1). The first real theme is Savanna's, extracted from their shipped CSS and audited in §4.12 — **four of their ten brand colours fail WCAG and are mapped to accessible variants**.
- **Semantic invariance rule (enforced by review + contract tests):** adaptive modes may only *add* scaffolding — bigger tokens, extra audio slots, decomposed steps, phrase-bank buttons. They may never remove `fieldset/legend/label`, add `tabindex` to non-interactive elements, block pinch-zoom, or swap a native control for a custom widget.
- **Pacing switching is a projection, not a rebuild:** `grouped` renders a step's fields together; `one-per-page` renders one field per synthetic step. Same `values` map, same validation, same `stepId` lineage (synthetic steps are `dob#2`), so switching mid-flow cannot lose data — this is a **mandatory test** (§9.2, T-07).
- **Portable profile:** `?op_prefs=<base64url(json)>` on arrival, `localStorage` for persistence, Savanna account for cross-device, QR for assisted hand-off. Never contains a diagnosis, only capability settings.

### 4.6 Distribution and DOM isolation

| Channel | Artifact | Isolation approach |
|---|---|---|
| React | `@openpath/react` | Normal React; consumer's CSS may leak in → all rules scoped under `.op-root` |
| Web component | `<openpath-form schema-url locale>` | **Light DOM** (`createRenderRoot(){return this}`) + `.op-root` wrapper + `@layer openpath`; `@scope (.op-root)` inside `@supports (selector(:scope))` as enhancement only |
| `<script>` **(v1.1)** | `openpath.iife.js` (Preact, target ≤ 45 KB gzip) | Same as WC; `OpenPath.mount('#el', config)`; no globals beyond `window.OpenPath`; CSP-friendly (no `eval`, no inline styles). v1.0 embeds use the web component only |
| REST/WSS | `@openpath/server` | Bearer + signed session cookie; rate-limited |

**Why not Shadow DOM (record this in the ADR):** IDs are root-scoped, so `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-activedescendant` and `<label for>` pointing across the boundary fail *silently* — the failure mode is an unlabelled input that only a screen-reader user experiences. Reflected element-reference ARIA resolves outward only and is not available on our WebView floor. Light DOM costs us style encapsulation, which we buy back with `.op-root` prefixing and a single `@layer`.

**Host contract** (what an institution must guarantee to embed): must not strip `lang` attributes, must not set `user-scalable=no`, must load the bundle with `defer`, and must expose the CSP `connect-src` for `api.openpath.et`. Publish this as a 10-line checklist; enforce a runtime `checkHostEnvironment()` that warns in console during dev.

### 4.7 Speech subsystem (corrected tiering)

```
                ┌──────── Tier 0 ────────┐   pre-recorded .opus, cached by SW
tap-to-hear ───►│  match by content key  │── hit ──► play (0 ms, 0 ETB, offline)
                └───────────┬────────────┘
                            │ miss
                ┌───────────▼────────────┐   Azure am-ET-Ameha, p50 1.05 s, $15/1M chars
                │  Tier 1a: cloud TTS    │── ok ───► play (dynamic text, online)
                └───────────┬────────────┘
                            │ fail/slow
                ┌───────────▼────────────┐   Addis Voice 2 (am-hamen): best quality, p50 5.4 s
                │  Tier 1b: quality TTS  │── BUILD-TIME only in v1.0: pre-generate, never call at runtime
                └───────────┬────────────┘   (batch-generate at build, store as Tier 0)
                            │ offline
                ┌───────────▼────────────┐
                │  Tier 2: local/browser │   window.speechSynthesis (en only), else text
                └────────────────────────┘

voice input ──► MediaRecorder (0.32 s / 1.12 s chunks) ──► WSS proxy ──► Addis Scribe Streaming
            ──► homophone fold + number normalise ──► slot validate ──► <AnswerConfirmation>
                                                       (accept only on explicit confirm)
```

**Key engineering calls:**
- **Pre-generate, don't stream, when the text is known.** Every string in `content/` is a *content key*. A build script renders each key once via Addis Voice 2 (best quality), stores Opus at 24 kbps mono in the CDN/SW cache, and the runtime looks up by key hash. Result: demo-quality Amharic voice with **zero runtime latency and zero runtime cost**, and the best-sounding model used where it matters. This is the single highest-leverage idea in the whole speech plan, and the report only half-states it.
- **Runtime cloud TTS only for user-generated content** (names on the review page, entered text read back).
- **Voice input is never a required path.** Push-to-talk, 60 s cap, visible waveform, live transcript, and acceptance only through `<AnswerConfirmation>` with visual + audio read-back. Slot-typed targets (`name`, `phone`, `date`, `enum`) get post-processing: phone → digit normalisation, date → EC/GC slot parse, enum → fuzzy match to the option list with "did you mean" rather than free text.
- **Hard caps** (protect budget): ≤ 120 s of ASR and ≤ 90 s of cloud TTS per session; per-tenant daily ceiling in the server; graceful 429 UI ("voice input is taking a break — you can type or tap instead"). Never a dead end.
- **No audio leaves the device without consent copy.** Raw audio is streamed to the proxy and **not persisted**; server logs record duration/bytes/locale only. Record this in the DPIA (§14.3).

```ts
export interface SpeechProviderAdapter {
  id: string;
  supportsLocale(l: Locale, mode: 'asr' | 'tts'): boolean;
  warm?(l: Locale, mode: 'asr' | 'tts'): Promise<void>;
  speak(req: { text: string; locale: Locale; rate?: number; onBoundary?: (i: number) => void },
        signal?: AbortSignal): Promise<void>;
  startStreamingASR(locale: Locale,
        cb: (r: Partial<Transcript>) => void,
        signal?: AbortSignal): Promise<{ stopAndFinalize(): Promise<Transcript> }>;
  transcribeBatch(blob: Blob, locale: Locale): Promise<Transcript>;
}
```

### 4.8 Backend (`@openpath/server`)

**Stack:** Node 22 + Fastify 5, Postgres 16, S3-compatible object storage (audio, document uploads), Redis for rate limits/idempotency, Zod-validated routes, OpenTelemetry traces with PII scrubbing.

**Data residency (non-negotiable, ADR-004):** the Postgres primary, object storage bucket, and backups all live **inside Ethiopia** with an Ethiopian-region provider or colocated hardware. No replication of PII outside the country in v1.0. This constrains provider choice from day 1 — do not scaffold on a US/EU managed Postgres and plan to migrate later; that migration touches every table and is a 3-week tax.

| Endpoint | Purpose | Notes |
|---|---|---|
| `GET /api/v1/schemas/:id` | Schema delivery, `ETag` + long cache | No PII; CDN-cacheable |
| `POST /api/v1/sessions` | Create anonymous session, prefill from tenant profile | Returns `instanceId` + `rev`; TTL 30 days |
| `PATCH /api/v1/sessions/:id` | Autosave sync, `If-Match` | Idempotency-Key; 409 → merge |
| `POST /api/v1/sessions/:id/submit` | Final submission, server-side revalidation | Re-runs the same zod schema; rejects without confirmation token for ASR-filled values |
| `POST /api/v1/auth/fayda/start` \| `/callback` | Identity adapter — **mock IdP in v1.0**, live eSignet behind an off-by-default flag | Same PKCE contract both ways; v1.0 never depends on NIDP availability |
| `POST /api/v1/uploads` | Document upload, presigned PUT | Virus scan, EXIF strip, 90-day retention default |
| `WSS /api/v1/speech/stream` | Addis Scribe proxy | Origin allowlist, per-session cap, no audio persistence |
| `POST /api/v1/tts` | Cloud TTS proxy | Trim/validate length, cache by content hash |
| `POST /api/v1/consent` | Append-only consent + witness attestation log | Hash-chained; exportable evidence bundle |
| `POST /api/v1/help` | Human-help request webhook (WCAG 3.2.6) | Includes `assisted` flag |

**Never in the backend:** eligibility decisions, disability inference, or "accessibility profile" as a diagnostic field. The server stores capability settings and nothing that reads as a medical record.

### 4.9 Ethiopian domain package

| Module | Implementation | Correctness strategy |
|---|---|---|
| **EC ↔ GC** | **Do not hand-roll.** Runtime: [`ethiopian-calendar-date-converter@2.1.6`](https://www.npmjs.com/package/ethiopian-calendar-date-converter) (MIT, **1.15 KB gzipped** measured, bidirectional, explicit GC 1900-03-01…2100-02-01 limits) behind a thin adapter. Dev-only reference: `kenat@4.0.0` (MIT, zero-dep, TS types — but 20.9 KB gzipped even tree-shaken, so it verifies rather than ships) | Both pinned. **60 golden vectors already generated and committed** ([`phases/assets/ec-gc.vectors.csv`](phases/assets/) — 60/60 agreement, 2,399-date sweep, 0 disagreements). Range guard 1900-03-01…2099-09-11 excludes a known `kenat.toGC` off-by-one (2099-09-12…2100-12-31) — file upstream. Human sign-off still required on 3 anchor dates + 1 real document pair before shipping |
| **Year-only DOB** | `{ yearOnly: true, year, calendar }` → stored with `precision: 'year'`; day/month never fabricated | Fayda update-centre rule honoured explicitly in UI copy |
| **Patronymic names** | Three fields: ስም / የአባት ስም / የአያት ስም, one `<fieldset>`, one review row, no "surname" concept | Never reorder into Western first/last; keep user-entered order in all output formats |
| **Address** | **Free text first, suggestions second — never a gatekeeper.** Region/City Admin = native `<select>` (14, stable). Zone/Sub-city = native `<select>`, filtered (5–20). Woreda = native `<select>`, filtered (5–30) + an explicit *"My woreda is not listed"* escape that reveals free text. Kebele + landmark = free text with hint. A value outside the dataset produces a **soft warning, never a blocking error** | Dataset is optional enrichment, imported at build time from OCHA HDX COD-AB with provenance metadata (`source, retrievedAt, adminLevelCounts, knownGaps`); the form still works with the file absent. Build pipeline generates the dataset from an authoritative source sheet reviewed by the content team; ship versioned with the schema; **never** fetch live government APIs |
| **Phone** | Accept `+2519…`, `09…`, `07…`, spaces/hyphens, Arabic-Indic digits → normalise to E.164 | Property tests over a 200-case fixture; never auto-jump split boxes |
| **Fidel / homophone folding** | Unicode NFC; fold homophones (ሀ/ኀ/ሓ, ሰ/ሠ, አ/ዐ, ጸ/ፀ, ኸ/ኀ…) for *match only*, never for storage | Storage keeps the user's exact spelling; folding applies to autocomplete/normalisation |
| **Number → fidel words** | 0 ዜሮ, 1 አንድ, 2 ሁለት, 3 ሶስት, 4 አራት, 5 አምስት, 6 ስድስት, 7 ሰባት, 8 ስምንት, 9 ዘጠኝ; phone/ID numbers read digit-by-digit; cardinals (መቶ/ሺህ) only for quantities | Native-speaker review is part of the definition of done — the report's 28.18% numeric-prompt WER is exactly this gap |
| **Collation/search** | Fidel-aware prefix + folded-form index for select/search components | Test with real Kebele and Woreda names |

### 4.10 ADRs to write in week 1

| ADR | Decision |
|---|---|
| 001 | Native HTML + selective React Aria hooks; no custom ARIA widgets |
| 002 | Typed reducer, not XState, for the form engine |
| 003 | IndexedDB-first persistence with server sync; 1 s debounce |
| 004 | **Data residency: primary store in Ethiopia; no PII in vendor logs** |
| 005 | Pre-generate TTS audio at build time; cloud TTS only for user content |
| 006 | Addis Scribe for streaming ASR + mandatory confirmation; no free-text-only voice fields |
| 007 | Light DOM + `.op-root` scoping; Shadow DOM rejected |
| 008 | Preference model is orthogonal capability tokens; no diagnostic "modes" |
| 009 | `@layer` isolation guaranteed; `@scope` enhancement only |
| 010 | Mulberry/Open Symbols as default symbol set (licensing) |
| 011 | Identity adapter interface; eSignet sandbox + mock IdP from day 1 |
| 012 | Preact for `wc`/`standalone`, React for `react`; shared core |
| 013 | Specced bundle budgets enforced by `size-limit` in CI |
| 014 | No accessibility overlay, no third-party widget, ever |

### 4.11 Performance budgets (enforced in CI)

| Artifact | Budget (gzip) | Rationale |
|---|---|---|
| `@openpath/react` core + 18 components | **≤ 120 KB** | Plus host app; 2 GB Android |
| `openpath.iife.js` (Preact build, v1.1) | **≤ 45 KB** | Single `<script>` embed on legacy pages |
| CSS (all layers + tokens) | **≤ 22 KB** | No icon font, no utility framework |
| Tier-0 Opus manifest (120 prompts) | **≤ 900 KB total**, lazy per-step | 24 kbps mono |
| Initial JS executed before first input | **≤ 90 KB** | |
| LCP on Moto G-class / Slow 3G (throttled) | **< 2.5 s** | |
| Time to first interactive question, offline, warm SW | **< 800 ms** | |

### 4.12 Savanna host design system (from `alx-africa/Savanna-static-pages`)

The host application is **Rails + Sprockets + Bootstrap 5 + React islands + Font Awesome + VideoJS**, shipping **1.5 MB of global CSS**. Full audit: [`phases/assets/savanna-theme-contrast.md`](phases/assets/savanna-theme-contrast.md).

**Brand tokens exist and are usable** — `--savanna-aice-{primary,secondary,accent,tertiary,light}[-40/-60/-80/-hover]`. We map them to `--op-*` rather than inventing a palette, so OpenPath looks native in Savanna.

**But four of them fail WCAG** (measured, not estimated):

| Colour | Ratio on white | Verdict |
|---|---|---|
| `primary` navy `#002b56` | 14.19 | ✅ primary buttons, headings, **focus ring** |
| `accent` purple `#5648b7` | 6.99 | ✅ secondary actions |
| `link` blue `#2275d7` | 4.57 | ✅ (do not lighten) |
| brand red `#db3e3e` | **4.40** | ❌ text → use `#d83d3d` (4.51) |
| muted grey `#98a3ae` | **2.57** | ❌ text → use `#6e767f` (4.60) |
| `secondary` green `#05f283` | **1.50** | ❌ never text, **never a focus ring** |
| `tertiary` blue `#67bbdf` | **2.15** | ❌ decorative only |

So the theme file ships with accessible variants and `tokens.pairs.json` includes every pair, which means a future "restore brand fidelity" PR fails the build instead of failing a low-vision user.

**Two structural findings that affect architecture:**

1. **Global CSS collision is the primary embed risk.** A 1.5 MB Bootstrap-based stylesheet plus host JS writing inline styles (`body.sidebar-collapsed`, per-element `display`) will fight our components. `.op-root` scoping + `@layer openpath` are the mitigation, validated by a real host fixture (journey J-13).
2. **Savanna has no Ethiopic font and no Ethiopic content** — 76 font files, zero Ge'ez glyphs, `<html lang="en">` only. Our Amharic UI is the first such text in the product. Body font is Poppins (no Ethiopic coverage), so the font stack, a subsetted Noto Sans Ethiopic, line-height and visual QA are scheduled work in P2 — not a tail task. Lexend is already in their bundle, which makes it the evidence-backed choice for reading-assistance mode.

**Note for the baseline (§11.2):** these three pages are the learner *dashboard* — the destination after onboarding, not the registration form. They give us the visual language and a real embed host; they do **not** replace measuring the incumbent form.

---

## 5. Accessibility engineering standard (the contract)

### 5.1 The bar

WCAG 2.2 **AA**, plus these deliberate tightenings:

| Criterion | Minimum | OpenPath ships | Why |
|---|---|---|---|
| 2.5.8 Target Size | 24×24 | **48×48 px, ≥ 8 px spacing** | Motor-impairment evidence; thumb use on minibuses |
| 1.4.11 Non-text Contrast | 3:1 | 3:1 input borders **and** 3:1 focus ring vs. both surface and control | Low vision + glare |
| 2.4.11 Focus Not Obscured | Minimum | `scroll-margin-block: 96px` everywhere; no sticky bar may cover a focused field | Magnifier users |
| 3.2.6 Consistent Help | — | Help affordance at identical position on **every** step, including review and error states | Stated expectation, not optional |
| 3.3.7 Redundant Entry | — | Prefill resolver + "same as above" pattern + no re-asking after error | |
| 3.3.8 Accessible Authentication | — | Passwordless (OTP/magic link/Fayda) default; password optional with show/paste/autofill allowed | |
| 1.4.12 Text Spacing | — | Must survive 1.5× line, 0.12em letter, 0.16em word, 2× paragraph spacing — no fixed heights anywhere | |
| 1.4.10 Reflow | 320 px | Tested at 320×568 **and** 1280×1024 @ 400% | |
| 1.2.2 Captions (prerecorded) | A | Every audio prompt has its text on screen **and** in a transcript; no audio-only content exists anywhere in the flow | Deaf and hard-of-hearing users, plus everyone on a muted or silent phone |
| 1.2.6 Sign Language | **AAA** | **Not shipped in v1.0** — cut deliberately (§3.5, K1). Captions and visual instruction cards carry the comprehension load |
| COGA | guidance | One proposition per line in Easy-Read; no pronoun co-references; no timed sessions; explicit "I don't know" options where the service can accept them | |

### 5.2 Component Definition of Done

Every component PR must satisfy all of the following, checked in review. No exceptions, no "fix in a follow-up".

**Semantics & naming**
- [ ] Correct native element; no `role` patched onto a `div` unless no native equivalent exists (documented in the component page)
- [ ] Programmatic name = visible label text at the *start* of the accessible name (WCAG 2.5.3, voice control)
- [ ] Group semantics via `<fieldset>`/`<legend>`; single-question pages put `<label>`/`<legend>` **inside** the `<h1>`
- [ ] `aria-describedby` order: hint, then error; hint is one sentence with no links
- [ ] `lang` set correctly on any Amharic string inside an English page and vice versa

**States**
- [ ] Focus visible with a 3 px ring at ≥ 3:1 against both backgrounds; never obscured (2.4.11)
- [ ] `aria-invalid` + inline error + error-summary link all wired, same wording
- [ ] Disabled states are avoided entirely for submit; if used, the reason is programmatically exposed
- [ ] Loading/pending stated with `role="status"` and not by colour alone

**Keyboard**
- [ ] Full operation with Tab/Shift+Tab/Enter/Space/Arrows/Esc; arrow-key behaviour matches the APG pattern for the widget
- [ ] No keyboard trap; Escape always exits overlays; focus returns to the trigger
- [ ] Focus order matches visual order at every breakpoint

**Screen reader (verified, not assumed)**
- [ ] NVDA 2026.x + Firefox and Chrome: label, value, hint, error, and required/optional state all announced once
- [ ] TalkBack + Chrome on Android 8–14: same, by swipe and explore-by-touch
- [ ] Live-region updates debounced ≥ 1,400 ms and never fire while typing
- [ ] No `aria-live` on a container that re-renders the whole page (would re-announce everything)

**Visual**
- [ ] 400% zoom, no horizontal scrollbar at 320 CSS px
- [ ] `forced-colors: active` (Windows HCM) and `prefers-contrast: more` render usably; borders survive
- [ ] `prefers-reduced-motion: reduce` removes all non-essential animation
- [ ] Ge'ez text: `line-height ≥ 1.65`, no italics, no clipping of ascenders/descenders, Noto Sans Ethiopic fallback subset
- [ ] Contrast: text 4.5:1, UI 3:1, focus 3:1 — asserted by a test, not by eye

**Tests**
- [ ] Unit tests for logic; Playwright + axe-core with **zero violations** across default/focused/error/conditional/320 px/forced-colors states
- [ ] Target-size assertion (`boundingBox ≥ 48×48`) on every interactive element
- [ ] Contract test proving the component works when rendered in the Light-DOM custom element context
- [ ] Storybook story with an a11y doc page; entry in the docs site with AT behaviour notes

### 5.3 Automated gates (CI)

| Gate | Tool | Failure mode |
|---|---|---|
| WCAG 2.0/2.1/2.2 AA, zero violations | `@axe-core/playwright` across a matrix of 6 states × 2 locales × 2 viewports | Blocks merge |
| Target size ≥ 48 px | custom Playwright assertion | Blocks merge |
| Focus-ring contrast | custom token test | Blocks merge |
| Bundle budget | `size-limit` | Blocks merge |
| Missing translations / schema-lint | custom | Blocks merge |
| Visual regression | Playwright screenshots (light, cream, dark, HCM) | Warns, human triage |
| Storybook a11y panel | `@storybook/addon-a11y` | Warns in PR |

Realistic expectation: these catch roughly half the issues. The other half is §5.4.

### 5.4 Manual protocol (release gate, every milestone)

Run the full script on **8 named configurations**. Each is a person-shaped scenario, not a checklist:

| # | Config | Script (abridged) |
|---|---|---|
| 1 | Windows + NVDA + Chrome | Full 5-chapter registration: enter name → submit empty DOB → recover from error summary → review → edit one answer → submit |
| 2 | Windows + NVDA + Firefox | Same, plus conditional branch and language switch mid-form |
| 3 | Android 8 / 2 GB + TalkBack + Chrome | Explore-by-touch through address cascader; document capture with spoken framing; voice input + confirmation |
| 4 | Android 13 + TalkBack | Same as 3, plus back-navigation and form-recovery banner |
| 5 | Keyboard only, no mouse | Every task; verify no traps, logical order, visible focus |
| 6 | 400% zoom + 320 px, Windows | Complete flow in Amharic; assert `scrollWidth ≤ innerWidth`; assert focus never obscured |
| 7 | Windows High Contrast + `prefers-reduced-motion` | Full flow; no invisible borders, no information by colour |
| 8 | Switch access / Voice Access | Complete 3 tasks by switch scanning and by "Click Continue" voice commands |

**Device lab minimum (buy, don't borrow):** 1× Redmi 9A-class (2 GB, Android 9), 1× Pixel 4a (Android 13), 1× Windows laptop with NVDA + Firefox/Chrome, 1× cheap Android tablet, 1× Bluetooth keyboard, 1× wired switch interface (or Android Switch Access + a $15 BT switch). Budget in §12.4.

### 5.5 What automation provably cannot cover (state in the conformance report)

Screen-reader speech output, live-region timing collisions, Amharic TTS mispronunciation, Easy-Read co-reference quality, whether captions alone are enough for Deaf readers, 2.4.11/2.5.7/3.2.6/3.3.7/3.3.8 flow criteria, and cognitive load. These are covered by §5.4 and §9.4 only.

---

## 6. Content and localization workstream (the real critical path)

Code is the predictable part. Content is what slips. Start it in week −1 and treat it as a schedule input, not a task.

| Deliverable | Volume (v1.0) | Owner | Lead time | Blocks |
|---|---|---|---|---|
| Amharic + English UI strings | ~420 keys × 2 | Amharic editor | 3 weeks, rolling | Every component |
| Error messages (keyed, parameterised) | ~70 codes × 2 | Editor + eng | 1 week | Validation engine |
| Easy-Read blocks (consent, identity, disability disclosure, help) | ~16 blocks, human-verified | Editor + ENAID reviewer | 2 weeks | Consent step, pilot |
| Tier-0 Opus prompts | ~120 prompts × am (+en fallback) | Voice talent + studio | 1 week recording, 1 week QA | Speech tier 0 |
| Caption / transcript QA | 120 prompts, checked word-for-word against on-screen text | Editor | 1 week | Speech tier 0, WCAG 1.2.2 |
| Ethiopic font subset + metrics QA | Noto Sans Ethiopic (OFL) subset; line-height and x-height reconciliation against Savanna's Poppins | Designer + eng | 3 days | Every Amharic screen |
| Phrase banks | 3 banks × 2 languages × ~40 phrases | Editor + employment SME | 2 weeks | Composer, Passport |
| Address dataset | Import OCHA HDX COD-AB (CSA/BoFED-sourced) at build time with provenance; region names am/en verified; **Amharic names for ~1,082 woredas is its own content workstream**, so v1.0 ships transliterated names where Amharic is unverified and never blocks entry | Content team + eng pipeline | 1 week (import) | Address fields + R16 |
| Glossary (civic + disability terms, am/en) | ~150 terms, with plain-language equivalents | Editor | 2 weeks | Consistency across whole product |

**Non-negotiable rules:**
1. **No machine translation ships.** MT may draft; a human signs off every string. Machine-translated legal consent in a registration flow is a liability, not a shortcut.
2. **Easy-Read content is human-authored and human-verified**, never LLM-rewritten at runtime (the report is right about this; make it a lint rule — no runtime content transformation of legal text).
3. **With signed video out of scope, captions must do the work.** Every audio prompt carries its exact text on screen and in a transcript; a question that only works when heard is a defect, not a style choice. Deaf participants in U1 test exactly this (§9.4).
4. **Recording is studio, not phone-diary.** 24 kbps mono Opus, −16 LUFS, scripted with pronunciation guide.
5. **String freeze dates** exist in the sprint calendar (S4, S9, S12). Missing a freeze delays the milestone; it does not get absorbed.

---

## 7. Phase 0 — the 10-day hackathon sprint

### 7.1 Reality check before day 1

The report's Day 1–10 sequence contains ~**50–60 eng-days** of work. Three engineers have **~30 gross / ~24 productive eng-days** (18 h/day of *effective* output is not real).

**Re-derived from our own scope (13 Nov 2026), not from the report's prose:** engine 7.0 + components 16.2 + backend 7.5 + embed 1.0 + demo wiring 2.0 + AT pass/rehearsal 4.5 = **≈ 38.2 eng-days against 24 productive — a 1.6× gap.** The honest resolution (detailed in [`phases/P1-hackathon.md`](phases/P1-hackathon.md) §1):

- The 10-day window ships **14 of the 18 v0.9 components** at sprint-DoD; the other 4 land in early P2 and are absorbed by the 84-day buffer.
- **ASR covers 1 slot (name), not 3**; the voice *honesty* moment survives, the breadth does not.
- The descope ladder is **pulled on day 1** (≈ −4 eng-days), not when the team is behind.
- A **15-day variant** (§Appendix A of the P1 plan) is the only version that fits comfortably; if the calendar is negotiable, take it.

So Phase 0 ships **14 components, 2 adaptive modes, 2 speech tiers (pre-generated + cloud TTS) with 1 ASR slot, 1 identity path, 1 embed channel** — and *not*: full 33-document identity matrix, full EthSL library, ASR on every field, self-hosted inference, multi-language review.

**Rule for the sprint:** every feature must be demoable on a real Android phone with TalkBack, or it does not get built. No feature without a demo moment.

### 7.2 Pre-work (days −5 to 0) — do this or the sprint fails

| # | Task | Owner | Lead |
|---|---|---|---|
| P1 | Addis AI + Azure Speech accounts, keys, quota verified with a live curl; record p50 latency from **Addis Ababa** (not from a VPN) | Eng C | 2 d |
| P2 | Devices acquired + charged: Redmi 9A-class, Pixel, Windows laptop with NVDA installed | All | 5 d |
| P3 | **Record 40 Tier-0 Amharic Opus prompts** (name, DOB, address, consent, errors, help) | Editor + studio | 4 d |
| P4 | Editorial pass: confirm all 40 audio prompts match their on-screen text; write the 8 Easy-Read blocks on the demo path | Editor | 4 d |
| P5 | String freeze v1: ~120 Amharic + English strings for the demo schema only | Editor | 3 d |
| P6 | Demo schema authored (`savanna-onboarding-v1.json`, 5 chapters, 1 branch, 1 review) | Designer + Eng A | 2 d |
| P7 | Repo scaffold, CI, tokens, Storybook skeleton | Eng B | 1 d |
| P8 | OPD contacts confirmed for a Day-10 walkthrough (ENAB/ENAD/ENAID members, 3–4 people, compensated) | Design | 5 d |
| P9 | Mock eSignet IdP contract agreed (same shape as real, no government dependency) | Eng C | 1 d |

### 7.3 Day-by-day lanes

**Eng A — engine & state** · **Eng B — components & a11y** · **Eng C — backend, speech, embed** · **Design — tokens, content wiring, demo**

| Day | Eng A | Eng B | Eng C | Design | Frozen output |
|---|---|---|---|---|---|
| **1** | Schema types + reducer + step router; `values` map; validation scaffolding | Tokens (`@layer`, `--op-*`), `.op-root`, focus ring; TextInput, PhoneInput, RadioGroup, CheckboxGroup | Fastify skeleton; schema endpoint; sessions endpoint; deploy pipeline to ET host | Visual system: type scale, Ge'ez line-height, 4 surfaces, contrast-validated tokens | Monorepo green in CI; 4 inputs axe-clean |
| **2** | Validation on Continue; error model (keyed codes); branch resolver + `normalizeReturnUrl`; history sync | ErrorSummary (auto-focus, title prefix), FieldError, FieldGroup, QuestionPage | Speech proxy (WSS) with origin allowlist + caps; TTS proxy with content-hash cache | Error/hint/instruction patterns; 30 screens of the demo flow | A 5-step form that validates and routes |
| **3** | Prefill resolver (3.3.7); persistence adapter (IndexedDB) + 1 s autosave; FormRecovery banner | DateInput (EC/GC + year-only), name group, EthiopianAddressSelector (**14 regions/cities** = 12 states + Addis + Dire Dawa; filtered zone/woreda native selects + "My woreda is not listed" free-text escape) | Pre-generate Tier-0 audio for the 40 prompts → CDN; Opus cache loader in SW | Amharic error copy review; address dataset spot-check | Offline-capable, Ethiopian-localised form |
| **4** | MultiStepForm complete; CheckYourAnswers data model; step announcements | CheckYourAnswers (`<dl>`, visually-hidden Change context); ProgressIndicator; announcer + debounce | Persistence sync endpoint; QR export; mock eSignet RP flow | Review page layout; demo script v1 | Interrupt → refresh → resume works |
| **5** | Preference store + projection switch (grouped ↔ one-per-page) | AccessibilityPreferenceManager; EasyReadRenderer; **safe-area/zoom audit** | Voice input wiring (Addis Scribe streaming) + slot post-processing | **Mid-sprint usability check** with 2 colleagues + 1 external screen-reader user | Mode switch with zero data loss |
| **6** | GuidedQuestion integration; Easy-Read content slot; transcript panel | GuidedQuestion (Listen / Easy-Read bar + transcript), ReadAloudController (Tier 0 → Azure) | AnswerConfirmation card + server-side confirmation token; ASR caps | Easy-Read block layout; phrase-chip tile design | Read-aloud + voice input + confirmation |
| **7** | Phrase composer state (no free-text-only paths) | AlternativeResponseComposer (2 categories), Accommodation Passport export | File upload + doc-type list + spoken "hold steady" hint; witness-attestation branch | Phrase bank curation (60 phrases, am/en) | Compose a profile answer in < 10 taps |
| **8** | Assisted co-completion mode (consent log, dual attestation) | HumanHelpRequest (3.2.6 consistent position); FileUpload polish; focus recovery | WC custom element (Light DOM) + Preact build (no IIFE — v1.1) | Mock Savanna host: React page + legacy HTML page | Single `<script>` embed works |
| **9** | Bug triage; a11y fixes from device pass | **Full manual AT pass** (§5.4 configs 1, 3, 5, 6) + fix list | Deploy hardening; rate limits; offline test with airplane mode; perf budget check | Backup demo video (screen + phone) recorded | Zero axe violations across all demo states |
| **10** | Fix-only until 12:00, then freeze | OPD walkthrough (3–4 users), note top 5 failures | Deploy freeze; rollback plan; key rotation | Pitch: 5 acts, 6 min, 2 devices live | **Demo + recorded fallback** |

### 7.4 What the demo must prove (5 acts, 6 minutes)

1. **It is a real form, done right.** One question per page, error summary, focus lands on `<h1>`, "Error:" in the title bar — narrated live by NVDA.
2. **Ethiopian by construction.** Enter a year-only Ethiopian-calendar birth date, pick Addis Ababa → Bole → Woreda → Kebele; show the review page showing both calendars.
3. **Adaptation with zero loss.** Mid-form, flip to Easy-Read + one-thing-per-page with a giant Back button; every answer is still there. Then flip to symbol composer and build a work-history sentence in 6 taps.
4. **Airplane mode.** Toggle it on stage, refresh, keep going, then reconnect and show sync + the recovery banner. This is the moment that wins a low-resource-context hackathon.
5. **Amharic voice, honestly.** Tap-to-hear an Amharic prompt (instant, from cache), speak a name (streaming ASR), show the confirmation card, and say out loud: *"28% word error rate means we never trust a transcript — we read it back."* Admitting the WER and showing the mitigation beats pretending.

**Always have:** the recorded video, a second phone, and a printed QR to the deployed URL. Live demos on conference Wi-Fi fail.

### 7.5 Definition of done for Phase 0

- **14 of the 18 v0.9 components** shipped (Tier A); every one axe-clean in 3 states, keyboard-complete, and verified live by one full AT pass over the assembled demo (per-component NVDA+TalkBack and the remaining 3 axe states are P2 `HARD-01`…`HARD-06`, ≈ 7.5 d). The 4 that do not ship — `PhoneInput`, `HumanHelpRequest`, `FileUpload`, `SaveAndResume` — are absorbed in early P2.
- All 5 demo acts pass on a real device, twice, in front of a person who did not build them.
- README, architecture diagram, ADR 001–009 written.
- A one-page "what we deliberately did not build and why" — judges reward honesty and it pre-empts the hardest question.

### 7.6 Descope ladder (pull in this order when behind)

1. Document capture → plain `<input type="file">` with a spoken hint (**−1 day**).
2. `SaveAndResume` → magic-link only, no local state token (**−0.5 day**).
3. Symbol composer → read-only symbol *display* with phrase chips, no sentence builder (**−1 day**).
4. Voice input → keep only on the DOB/name fields, drop the streaming waveform (**−0.5 day**).
5. Assisted co-completion → a single checkbox + consent log entry (**−0.5 day**).
6. Audit trail (`SaveAndResume`) → banner only (**−0.5 day**).

**Never descope:** error summary + focus management, offline autosave, mode switching, EC/GC date, one AT-verified path per disability group. Those five *are* the product.

---

## 8. Phase 1–5 — production v1.0 in 26 weeks

### 8.1 Workstreams

> **Detailed per-phase implementation plans live in [`phases/`](phases/).** The phases are P0 pre-flight, P1 hackathon, P2 foundation, P3 access & resilience, P4 voice & alternative response, P5 identity/backend/distribution, P6 assurance, P7 release & handover. P2–P7 map 1:1 to milestones M1–M6. Start with [`phases/P0-preflight.md`](phases/P0-preflight.md), then [`phases/P1-hackathon.md`](phases/P1-hackathon.md).

Three engineers own **A: engine & data**, **B: components & accessibility**, **C: speech, identity & backend**; the designer owns **D: design system & content**; contracted editor/auditor own **E: localization & assurance**. Six 2-week sprints per quarter, demo every second Thursday.

### 8.2 Milestones and exit criteria

| M | Week | Theme | Exit criteria (all must hold) |
|---|---|---|---|
| **M0** | 0 | Sprint debt paydown | Hackathon code triaged; 18 components under contract tests; CI gates blocking; ADRs 001–014 written; editor + EthSL contracts signed |
| **M1** | 6 | Engine + core library (alpha) | Component registry in Storybook, CI-count-checked (37 by M2); schema v1 frozen with migration harness; EC/GC golden vectors (60) green; axe gate blocking on all states; ≤ 120 KB budget met; internal alpha on 2 real forms |
| **M2** | 10 | Offline, review, adaptation | 100 forced-interruption tests with zero data loss; resume link; preference projection switch tested across all components; portable profile token; design tokens shipping with contrast validator |
| **M3** | 14 | Speech + alternative response | Pre-generated Opus → Azure routing live; ASR + confirmation on **3** slot-typed fields; `<100 ms` warm offline audio; phrase composer + Accommodation Passport; caption/transcript QA complete; **speech cost per session measured** |
| **M4** | 18 | Identity, backend, embed | Identity adapter + mock IdP on the real PKCE contract; FCN/QR entry; **8** configurable document types; witness attestation with hash-chained consent log; web component shipped to CDN; ET-region infra with backups |
| **M5** | 22 | Assurance | External WCAG-EM audit pass 1 (all findings fixed or waived in writing); OPD usability round 2 (12 participants, 4 disability groups); pen test remediated; performance budgets met on device floor |
| **M6** | 26 | v1.0 release | Conformance statement + a11y statement published; docs + integration guide; 2 partner integrations live; on-call runbook; v1.1 backlog ranked |

### 8.3 Epics with estimates

| Epic | Scope | Eng-days | Owner | M |
|---|---|---|---|---|
| E1 | Engine v1: schema v1 + migrations, validation, branching, prefill resolver, i18n runtime, history sync, error model | 26 | A | M1 |
| E2 | Component library: 36 components hardened to §5.2 contract, Storybook + docs | 40 | B | M1–M2 |
| E3 | Ethiopia domain: calendar adapter + vector verification, HDX address import, names, phone, homophone, number→fidel, collation | 15 | A | M1 |
| E4 | Offline & sync: SW, encrypted IndexedDB, sync queue, last-writer-wins, multi-tab **detection** | 17 | A | M2 |
| E5 | Adaptation & personalization: preference model, projection switching, portable profile, tenant defaults, contrast validator | 16 | B | M2 |
| E6 | Speech: adapters, tier router, build-time TTS generation, 3 ASR slots, confirmation tokens, caps, telemetry | 19 | C | M3 |
| E7 | Identity & documents: adapter + mock IdP, 8 doc types, file upload, witness flow, consent log | 14 | C | M4 |
| E8 | Alternative response: 3 phrase banks, bilingual composition grammar, Accommodation Passport export | 11 | B | M3 |
| E9 | Distribution: web component, theming API, CSP safety, versioned CDN, host-contract checker | 11 | C | M4 |
| E10 | Backend & platform: Fastify hardening, Postgres/ET region, uploads, retention jobs, observability, on-call | 21 | C | M4 |
| E11 | QA infrastructure: Playwright matrix, axe rule pack, target-size and contrast assertions, AT harness | 16 | B | M1–M5 |
| E12 | Docs, examples, Savanna mock host, integration guide | 10 | B | M6 |
| E13 | Security & privacy: threat model, DPIA, key management, pen-test remediation | 12 | A | M5 |
| | **Total** | **228** | | |

**Capacity check:** 3 engineers × 26 weeks × 5 days = 390 gross, **−20 % for reviews, meetings, holidays, on-call ≈ 312 productive eng-days**. Total 228 leaves **84 days (≈ 27 %)** — the v1.2 calendar and address decisions (§4.9) returned 13 days. That margin is deliberately **not** spent on new scope: it absorbs audit remediation (historically 10–15 % of surface), the M4 identity re-plan, and one milestone slip. If M5 surfaces more than ~40 days of audit work, trigger §8.6 — do not absorb it silently.

Non-engineering effort (parallel, needs its own capacity): Amharic editor ~45 d, Easy-Read review ~10 d, caption/transcript QA ~5 d, external audit ~8 d, usability testing ~12 d, accessibility consultant ~10 d.

### 8.4 Sprint calendar

| Sprint | Weeks | Content | Milestone |
|---|---|---|---|
| S0 | 1 | Debt paydown, ADRs, CI hardening, schema v1 draft, content kickoff | M0 |
| S1 | 2–3 | Engine core; 10 components; tokens v2; edit: string spec | |
| S2 | 4–5 | Branching + prefill; 8 components; EC/GC module + fixtures; address pipeline | |
| S3 | 6 | Hardening; alpha form #1 (learner); **string freeze 1** | **M1** |
| S4 | 8–9 | Autosave/sync (LWW); recovery + resume link; multi-tab detection | |
| S5 | 10 | Review flow; preference projection across all components; alpha form #2 (job app) | **M2** |
| S6 | 12–13 | Speech tiers + build-time generation; ASR slots; confirmation; caps | |
| S7 | 14 | Phrase composer; Passport; caption/transcript QA; **string freeze 2** | **M3** |
| S8 | 16–17 | Identity adapter; mock IdP; file upload + doc types; witness flow | |
| S9 | 18 | Backend hardening; ET infra; uploads; retention; web-component embed | **M4** |
| S10 | 20–21 | External audit prep + fixes; performance on device floor | |
| S11 | 22 | Audit pass 1 closes; usability round 2; **string freeze 3** | **M5** |
| S12 | 24–25 | Pen-test remediation; docs; partner integration #1 and #2 | |
| S13 | 26 | Release, conformance statement, handover, v1.1 planning | **M6** |

### 8.5 Quality gates between milestones

No milestone closes unless: (a) all §5.4 manual configs pass, (b) §3.3 scope matches what is actually built, (c) speech spend per session is inside §12.3 caps on real traffic, (d) content coverage is 100 % for shipped locales (CI-checked), (e) an OPD member has used the flow since the last milestone.

### 8.6 Second-wave deferral list (only if the horizon compresses to 20 weeks)

v1.0 is already the reduced scope. Getting from 241 to ~186 eng-days (20 weeks at 312 capacity) requires cutting *capability*, not just polish — so treat each row as a product decision:

| Deferral | Eng-days saved | What users lose |
|---|---|---|
| `VoiceInput` + `AnswerConfirmation` → pre-generated audio only, no ASR | 13 | Voice answering disappears; low-literacy users lose the dictation path (they keep tap-to-hear) |
| `AlternativeResponseComposer` → `<Textarea>` with worked examples | 11 | Flagship #3 disappears; non-speaking and low-literacy applicants lose the ability to compose without typing |
| Identity adapter + mock IdP → single FCN text field | 8 | No verified identity; witness flow becomes advisory |
| `SearchableSelect` → native `<select>` for all lists | 4 | Woreda lists become long native pickers — usable, unpleasant |
| `SaveAndResume` → local draft only (no resume link) | 3 | Device loss = data loss |
| Azure dynamic read-back → pre-generated audio only | 4 | User-entered text (names, free text) can no longer be read back |
| Witness attestation → plain checkbox + note | 4 | Weaker evidentiary trail for undocumented applicants |
| Theming to light + one high-contrast surface only | 3 | No cream/dark surfaces; some dyslexia and low-vision users lose their preferred contrast |
| **Total** | **50** | 241 → 191 eng-days; add ~1 week of trimming elsewhere for 20 weeks |

**If any of the first three rows is applied, re-baseline §11.2 targets and say so in the conformance statement.** Shipping a smaller product honestly beats shipping a promised product partially.

### 8.7 If the team is 1–2 engineers instead of 3

Do not build the monorepo fantasy. Ship a **single package** (`@openpath/react` + `@openpath/core` merged, no WC), 12 components, no speech beyond pre-generated Opus, no identity adapter (FCN text field only), no phrase composer, and make the Savanna mock host the only integration. Timeline: M1 in 8 weeks, v1.0 in ~16 weeks with the deferral list applied. The differentiator that survives is **the adaptive engine + offline recovery** — protect those two and cut everything else.

---

## 9. Testing, QA and research plan

### 9.1 The test pyramid as we actually run it

| Layer | Count target | Runtime | Blocks merge |
|---|---|---|---|
| Unit (Vitest): reducers, validators, EC/GC, normalisers, prefill, branch resolution | ~600 tests | < 30 s | Yes |
| Property-based: EC/GC round-trip, phone normalisation, homophone folding, date bounds | ~40 properties × 200 runs | ~60 s nightly | Nightly |
| Component contract (Testing Library): ARIA wiring, keyboard map, error linkage | ~28 × 8 cases | < 3 min | Yes |
| E2E (Playwright): 6 journeys × 3 viewports | ~40 specs | ~8 min | Yes |
| Accessibility (axe-core): 6 states × 37 components × 2 locales × 2 viewports | ~890 scans | ~15 min | Yes |
| Visual regression: 4 surfaces × 3 viewports | ~340 shots | ~10 min | Warns |
| Bundle size | 6 artifacts | < 30 s | Yes |
| Manual AT (§5.4) | 8 configs × 1 script | 1 day per milestone | Milestone gate |

### 9.2 The 12 mandatory journeys

Each journey is a Playwright spec **and** a manual script. This list is the product's real specification.

| # | Journey | Passes only if |
|---|---|---|
| J-01 | Happy path, 5 chapters, English, keyboard | All data survives review → edit → submit |
| J-02 | Same in Amharic, EC calendar, year-only DOB | No clipping, correct `lang` attributes, EC shown first |
| J-03 | Empty submit on 3 steps | Error summary focused, title prefixed, values intact, wording identical to inline |
| J-04 | Conditional branch (needs accommodation → follow-up fields) | Inline single-field reveal uses `aria-controls`, never `aria-expanded` on radio; multi-field goes to its own page |
| J-05 | Airplane mode mid-form, refresh, reconnect | 100 % values restored; recovery banner; sync completes without duplication |
| J-06 | Open in two tabs, edit both | Visible conflict notice; no silent overwrite |
| J-07 | Switch pacing mid-form (grouped ↔ one-per-page) | Zero data loss; focus lands on the current question's `<h1>` |
| J-08 | Enable Easy-Read + audio auto-play, then press Tab | Audio cancels instantly; no speech over screen reader |
| J-09 | Voice input a name, reject the transcript, retype | No transcript is ever saved without explicit confirmation |
| J-10 | Compose a work-history answer via phrase chips only | Answer is valid, reviewable, and editable as text afterwards |
| J-11 | 400 % zoom + expanded text spacing, full flow | No horizontal scroll, no obscured focus, no clipped Ge'ez |
| J-12 | File upload + witness attestation, offline | Upload validates type/size client-side; witness packet queues; consent logged |
| J-13 | **`<openpath-form>` inside a real Bootstrap 5 host page** (Savanna static-page fixture) | No style leakage in either direction, host's global CSS does not alter our geometry, axe-clean, keyboard and focus behaviour unchanged, Amharic renders with the correct font |

### 9.3 Release gates

1. Zero axe violations across the matrix.
2. §5.4 manual configs 1–8 pass, signed off by two people (one who did not write the code).
3. J-01…J-12 green on CI and on the device floor.
4. No open P0/P1 defects; no open accessibility-severity findings from the external audit.
5. Performance budgets met under throttling on the Redmi-class device.
6. Content coverage 100 %; Easy-Read blocks human-verified.

### 9.4 Usability and field research

| Round | When | Participants | Method | Output |
|---|---|---|---|---|
| U0 | Hackathon day 10 | 3–4 (blind, Deaf, intellectual disability) | 20-min moderated walkthrough on their own phones | Top 10 defects |
| U1 | M2 (week 10) | 8 (2 blind, 2 low vision, 2 Deaf — **captions-only test**, 2 cognitive/low literacy) | 40-min task sessions + comprehension checks + preference rating | Severity-ranked findings; instrumented time-on-task |
| U2 | M5 (week 22) | 12 across 4 groups (incl. 3 Deaf), mixed urban/rural, 2 regions | Same protocol, plus assisted-mode scenarios | Conformance + usability evidence for the statement |
| U3 | Post-launch | 24 across 6 regions | Longitudinal, funded separately | Impact paper |

**Ethics, non-negotiable:** compensated participation (1,500–2,500 ETB + transport, paid same day), consent in the participant's preferred modality (Amharic, Afaan Oromoo, Tigrinya, EthSL video, Easy-Read, or witness-based), no participant's real ID documents photographed, session data deleted after analysis, and the option to withdraw mid-session with payment intact. Partner with FEAPD/FENAPD members (ENAB, ENAD, ENAID, ENADB) and the University of Gondar GAT Center — and pay them for recruitment work, not just participation.

### 9.5 What we measure (instrumentation, PII-free)

Event names only, no field values: `form_started`, `step_viewed{stepId}`, `validation_failed{fieldId,code}`, `back_used`, `mode_switched{from,to}`, `audio_played{tier}`, `asr_used{slot,confirmed|rejected}`, `upload_attempt{result}`, `offline_entered`, `draft_recovered`, `form_submitted{durationBucket}`. Autosave payloads never include telemetry. Ship a documented opt-out and never instrument more than 12 events.

---

## 10. Risk register

Scored L (1–5) × I (1–5). Anything ≥ 12 gets a named owner and a standing agenda slot.

| # | Risk | L | I | Score | Mitigation | Early-warning trigger |
|---|---|---|---|---|---|---|
| **R1** | **Data-residency non-compliance** (PDPP 1321/2024 Art. 22): PII in the wrong jurisdiction | 3 | 5 | **15** | ET-region primary, object store and backups; no PII in vendor logs; DPA with every vendor; DPIA before M2; legal review of cross-border audio | Any infra PR that adds a non-ET region |
| **R2** | ASR quality (28.4 % WER) treated as text entry; corrupted records | 4 | 4 | **16** | Slot-typed targets only; confirmation gate; server-side confirmation token required for ASR-filled values; never a voice-only field | A single confirmed-but-wrong submission in QA |
| **R3** | Amharic content bottleneck (one fluent speaker) | 4 | 4 | **16** | Two reviewers + glossary + pronunciation guide; contract editor from week 1; string freeze dates in the calendar | Any sprint where translation lands < 3 days before build |
| **R4** | **Deaf users' comprehension now that signing is cut** — dense questions, consent clauses and disability disclosure may be misread | 4 | 3 | **12** | Plain language, one proposition per line, numbered visual instruction cards, captions + transcripts, text/video-relay help; **2 Deaf participants in U1 specifically test whether captions suffice**; EthSL is a funded v1.1 gate, not a silent drop | A Deaf participant fails the consent-comprehension check in U1 |
| **R5** | EC/GC conversion errors on leap/Pagume boundaries | **2** | 4 | 8 | Verified against two independent libraries (2,399-date sweep, 60 committed vectors); adapter range guard; `--require-human-signoff` gate; year-only precision retained | Any new fixture disagreement, or a library version bump that changes a vector |
| **R16** | **Stale/conflicting administrative data** rejects or mislabels a valid location (Ethiopia reorganised regions in 2020, 2021 and 2023; HDX COD-AB is stale; SSGI and OCHA disagree on Addis woredas; no open kebele dataset) | 4 | 3 | **12** | Suggestions never block; "not listed" escape at every level; dataset versioned with provenance and a visible build date; annual refresh owner named (Q6); soft warning routes unmatched values to human review | A user cannot complete the address step, or an OPD tester says their woreda is missing |
| **R6** | Old-WebView CSS/JS incompatibility (`@scope`, `dialog`, `BroadcastChannel`) | 4 | 3 | **12** | `.op-root` scoping; native `<dialog>` with a fallback; feature-detect everything; test on Android 8 device weekly | First device-lab regression |
| **R7** | Speech spend exceeds budget at scale | 3 | 3 | 9 | Build-time pre-generation (Tier 0); per-session caps; per-tenant ceilings; cost dashboard from M3 | Cost/session > 2× estimate at pilot |
| **R8** | Symbol-set licensing **returns in v1.1** (ARASAAC is non-commercial) | 2 | 4 | 8 | No pictograms ship in v1.0; licence resolved before v1.1 design starts; Mulberry/Open Symbols preferred | Any ARASAAC asset requested |
| **R9** | A partner expects **real Fayda verification** in v1.0, but only the mock adapter ships | 3 | 3 | 9 | Adapter interface + contract tests; FCN/QR path is production-real; live eSignet scoped as v1.1 with the MOU as its gate — say this in writing to Savanna before M4 | Partner requests eSignet in writing |
| **R10** | Accessibility regressions over time | 4 | 4 | **16** | CI gates + manual script per milestone + quarterly external audit + a11y champions in review | Two consecutive PRs failing gates |
| **R11** | Performance on 2 GB devices | 3 | 4 | **12** | Bundle budgets; Preact embed; lazy audio; LCP budget on real device | Budget breach in CI |
| **R12** | Scope creep from the 42-component catalogue | 5 | 3 | **15** | §3.5 is the boundary: any addition must name the row it displaces | A new component request without a displacement |
| **R13** | Vendor pricing/availability change (Addis AI promo already ended) | 4 | 3 | **12** | Adapter abstraction; Azure + open-weights alternates; 20 % budget buffer; self-host path documented (weights are open) | Price change notice or latency drift |
| **R14** | OPD recruitment/trust failure | 3 | 4 | **12** | Pay recruiters and participants; engage via FEAPD; share findings back; no extractive research | Sessions cancelled twice |
| **R17** | **Host CSS collision**: Bootstrap 5 + 1.5 MB global CSS + host JS writing inline styles alters our controls' geometry, contrast or focus visibility | 4 | 3 | **12** | `.op-root` scoping + `@layer openpath`; `checkHostEnvironment()` warnings; J-13 runs against the real Savanna fixture at every milestone; explicit host-contract doc | Any visual regression in the host fixture, or a host CSS change breaking our focus ring |
| **R15** | Draft data lost or exposed on shared devices | 3 | 4 | **12** | Encrypted local drafts with an honest limitation note; auto-expiry; explicit "delete my draft"; never cache PII in the SW | Any draft older than TTL found in storage |

---

## 11. Success criteria

### 11.1 Technical

| Metric | Target |
|---|---|
| axe-core violations (all states/locales/viewports) | **0** |
| WCAG 2.2 AA conformance (external WCAG-EM audit) | Full conformance, no unmitigated failures |
| Target size compliance | 100 % of interactive elements ≥ 48×48 px |
| Forced-interruption tests with data loss | **0 / 100** |
| Core flow offline completion | 100 % of the 5-chapter journey |
| ASR-originated incorrect submissions | **0** (enforced by confirmation token) |
| Bundle budgets (§4.11) | All met |
| LCP, Moto-G-class + Slow 3G | < 2.5 s |
| Component contract coverage | 28/28 with AT notes |

### 11.2 Human (measured at U1/U2, against a baseline we take in week 2 on the current Savanna form)

| Metric | Target |
|---|---|
| Task completion, blind users (NVDA/TalkBack), unassisted | ≥ 90 % |
| Task completion, Easy-Read users with a helper | ≥ 85 % |
| Task completion, motor-impairment users (keyboard/switch only) | ≥ 90 % |
| Task completion, Deaf users with **captions only** (no signing) | ≥ 85 % |
| Median time-on-task vs. baseline | ≥ 30 % reduction |
| Error-recovery success (unassisted, after a validation error) | ≥ 95 % |
| Self-reported ease (UMUX-Lite, validated Amharic adaptation) | ≥ 75 / 100 |
| Would use again / would recommend to a peer | ≥ 80 % |
| Preference-profile re-use across two partner portals | ≥ 60 % of pilot users |

Take the baseline in week 2. Without it, every later number is a claim, not a measurement — and the report's own evidence (30.4 % of browsing time lost to inaccessible forms) tells you the baseline will be bad enough to make the case on its own.

---

## 12. Budget

Excludes salaries and excludes the researcher/designer's time. ETB at ≈150/USD; confirm before committing.

### 12.1 One-off costs (Phase 0 + Phase 1)

| Item | Est. | Notes |
|---|---|---|
| Amharic voice talent + studio (120 prompts) | 40,000–80,000 ETB | 1–2 days, 2 voices, includes retakes |
| Easy-Read illustrations (16 blocks) | 12,000–20,000 ETB | No pictogram/symbol curation in v1.0 (§3.5, K3) |
| Participant compensation (U0–U2, ~24 sessions) | 45,000–60,000 ETB | 2,000 ETB + transport each |
| OPD recruitment fees | 25,000–40,000 ETB | Pay the organisations |
| External WCAG-EM audit | $2,500–5,000 | Independent, non-negotiable for the conformance statement |
| Penetration test (web + API) | $2,000–4,000 | Before M6 |
| Device lab | $700–1,200 | 2 phones, laptop already owned, BT switch, headphones |
| Legal review (DPIA, consent, vendor DPAs, 1321/2024) | $800–1,500 | Ethiopian counsel |
| Contingency 15 % | — | |
| **Total one-off** | **≈ $7.5k–12.5k** | v1.0 draft was $8.5k–13k; EthSL and symbol curation removed |

### 12.2 Recurring (monthly, pilot scale: ~10,000 submissions)

| Item | Est./month |
|---|---|
| ET-region Postgres + object storage + backups | $120–300 |
| CDN + compute (Fastify, 2 nodes) | $80–200 |
| Monitoring/observability | $50–100 |
| Azure Neural TTS (~4 M chars: dynamic read-back only) | ≈ $60 |
| Addis Voice 2 (build-time generation: ~2,000 clips once, then negligible) | one-off ≈ $150 |
| Addis Scribe ASR (10 % of users × 2 min × 5 ETB/min ≈ 10,000 ETB) | ≈ $65 (≈10,000 ETB) |
| **Total** | **≈ $375–725** |

### 12.3 Speech cost controls (design constraints, not optimisations)

Assume the vendor prices from §2.2: TTS 5 ETB/min of audio; ASR 3.5 ETB/1k chars and 5 ETB/min of audio. At those rates a naive "read every screen aloud + dictate every field" design costs **more per user than the rest of the platform combined**.

- **Tier 0 pre-generation** covers ~95 % of spoken words → near-zero marginal cost.
- Runtime cloud TTS only for user-entered content on review/confirmation.
- Caps: **≤ 60 s ASR per field, ≤ 120 s per session, ≤ 90 s cloud TTS per session.**
- Per-tenant daily ceiling with a graceful 429 that offers typing/voice-free alternatives.
- Cost dashboard in the admin view from M3; alert at 70 % of monthly ceiling.
- **The self-host path is real:** Addis Scribe weights are published, so at ~5,000+ sessions/month a single modest GPU (or CPU with batching at low volume) can beat vendor spend. Cost it at M3 with real traffic, not now.

### 12.4 Not funded by this budget (separate workstreams)

Multi-region field trials (~$25k–40k), longitudinal impact study, **EthSL production (12–20 clips, ~90k–150k ETB) if U1 justifies it**, a full sign library beyond that, self-hosted ASR, visual form builder, ISO 27001 certification.

---

## 13. Governance and engineering process

| Practice | Rule |
|---|---|
| Branching | Trunk-based; short-lived branches; feature flags for anything user-visible |
| Reviews | 1 approval normally; **2 approvals for `@openpath/core`, schema changes, and anything touching auth or PII** |
| PR template | Includes the §5.2 checklist — unticked boxes block review |
| Schema changes | Require a migration + a fixture showing an old draft loading correctly |
| Content changes | Require editor sign-off; CI blocks missing keys |
| ADRs | One per irreversible decision; recorded in `docs/adr/` before implementation |
| Versioning | Changesets + semver; `@openpath/react` breaking changes only in majors; embeds pin a major CDN URL |
| Demos | Every second Thursday, on a real device, by the person who built it |
| Post-mortems | Blameless, within 48 h, for every data-loss or a11y-regression incident |
| Documentation | Component page = purpose, anatomy, states, keyboard map, SR notes, do/don't, code |
| On-call | From M4, one engineer/week, runbook with the top 8 failure modes |

---

## 14. Legal, ethics and compliance workstream

### 14.1 Data protection (Proclamation 1321/2024)

In force since 24 July 2024; the ECA is the supervisory authority; the four implementing directives are still pending, which means **the statutory duties bind now** and the mechanics will arrive later. Build to the statute:

1. **Lawful basis + notice**: short, plain-language, in Amharic and English, with "why we ask" per field (`instructions`), plus a full privacy notice link. Consent where consent is the basis; service necessity otherwise.
2. **Data minimisation**: the NHS-style question protocol (§Appendix A) run on the Savanna schema before build — every field must justify itself. Target: cut ≥ 20 % of fields inherited from the legacy form.
3. **Storage limitation**: drafts 30 days, uploads 90 days, submissions per Savanna's statutory retention; automated deletion jobs with logged evidence.
4. **Localisation (Art. 22)**: primary store in Ethiopia; documented inventory of every cross-border flow (speech vendor, CDN, monitoring) with either no PII or explicit safeguards.
5. **Breach notification**: 72-hour internal runbook and an external template pre-drafted.
6. **Data subject rights**: access, correction, deletion via a documented support path (deletion inside the form itself for drafts).
7. **DPIA** before M2, updated at M4 when identity documents enter scope.
8. **Sensitive data**: disability/accommodation answers are sensitive — separate consent, tighter access control, never in analytics, never in logs.

### 14.2 Identity and eSignet

- Use the NIDP's eSignet OIDC (PKCE, state, nonce) with a written agreement; until then, the **mock IdP** keeps the contract honest.
- Store only the identifiers needed; never store raw identity-document images longer than the verification window.
- Witness attestation needs a real consent artefact: applicant signature/thumbprint equivalent, witness identification, timestamp, and an auditable chain — designed with the Fayda witness-consent form as the reference, reviewed by counsel.

### 14.3 Research ethics

See §9.4. Additionally: a one-page participant information sheet in 4 modalities, an ethics checklist reviewed by the accessibility consultant, and a written commitment to share findings with participating OPDs.

### 14.4 Open source and licensing

Decide before the first public commit: licence (Apache-2.0 recommended for institutional adoption), CLA or DCO, trademark policy for the name, and a `LICENSES.md` covering bundled assets — Mulberry/Open Symbols, Noto Sans Ethiopic (OFL), Cboard OBF schema (v1.1 only), and any ARASAAC usage with explicit permission.

---

## 15. First 48 hours (concrete)

| # | Action | Owner | Done when |
|---|---|---|---|
| 1 | Confirm the horizon and put §3.3 in front of whoever owns the deadline | Lead | Written sign-off on the v1.0 scope table |
| 2 | Open ADR-001…004 as PRs (esp. **ADR-004 data residency**) | Eng A | Merged |
| 3 | Get Addis AI + Azure keys; run the latency test **from Addis Ababa**; record p50 for both | Eng C | Numbers in the repo, not in a chat |
| 4 | Order devices; install NVDA + TalkBack; test the current Savanna form and record 10 minutes of the failure | Eng B | Video exists, tasks fail as expected |
| 5 | Book: studio day for Tier-0 audio, Amharic editor contract, and **2 Deaf participants for the U1 captions-only test** | Design | Dates on the calendar |
| 6 | Write the 120-key string list from the demo schema; start Amharic drafting | Editor | Spreadsheet shared |
| 7 | Stand up the ET-region Postgres + object store (or get a quote with a date) | Eng C | `psql` connects from CI |
| 8 | Baseline measurement on the current Savanna form (5 users, time-on-task + failures) | Design | Baseline table in §11.2 filled in |

Item 8 matters most: it converts every later claim into a delta.

---

## Appendix A — Question protocol (run before building any schema)

For every field, answer in writing:

1. Is this information needed **now** to deliver the service? If no → remove.
2. Who uses it, and for what decision? If nobody → remove.
3. How will accuracy be checked? (cross-field rule, ID check, witness)
4. What happens if the applicant cannot provide it? (must have an "I don't know / not sure" or an alternative-document path)
5. Which chapter, which step, and does it belong on the same page as its neighbours?
6. Does it need audio, an example, or plain-language/Easy-Read treatment? (declare it, don't retrofit)
7. Is it PII/sensitive → logging, encryption, retention, and review-page treatment.

A schema that cannot answer 1–4 is a legacy form wearing new clothes.

## Appendix B — EC/GC conversion: what must be true before shipping

**Status: largely satisfied on 13 November 2026.** Do not hand-roll the conversion — the arithmetic is trivial, but the epoch constant and leap-cycle phase are where a plausible implementation produces a silent one-day error in one year in four.

- [x] **Library chosen and verified.** Runtime `ethiopian-calendar-date-converter@2.1.6` (MIT, 1.15 KB gz); reference `kenat@4.0.0` (MIT, zero-dep, dev-only). Cross-checked on 2,399 sampled dates, GC 1900 → 2100: **0 disagreements**.
- [x] **60 golden vectors committed** ([`phases/assets/ec-gc.vectors.csv`](phases/assets/), 60/60 agreement) with provenance, versions and regeneration instructions in the companion README.
- [x] **Sept 11 / Sept 12 rule resolved:** shift follows the *Ethiopian* leap year (EC year ≡ 3 mod 4), not the Gregorian one — `2023-09-12`, `2026-09-11`, `2027-09-12` all confirmed by both libraries and by published Enkutatash dates.
- [x] **Known defect isolated:** `kenat.toGC` is one day early for GC 2099-09-12 … 2100-12-31 (476 days). Excluded by the adapter's range guard; upstream issue to be filed.
- [ ] **Range guard implemented:** accept GC `1900-03-01 … 2099-09-11`, EC `1892 … 2091`; reject outside with a specific error.
- [ ] **Human sign-off** on the three anchor dates plus **one real document pair** (Fayda card or Kebele ID showing both calendars, photographed with consent) — the 60 rows are computed agreement, not documentary evidence. Gate: `pnpm ethiopia:verify --require-human-signoff`.
- [ ] **Content caveat recorded:** EC day-labels oscillate by one against Gregorian within each 4-year cycle (7 January is Tahsas 29 in most years, Tahsas 28 in 2024 and 2028), so holiday-date prose is not a valid fixture source.
- [ ] UI copy explains *which* calendar is displaying, in both calendars' own month names (መስከረም…ጳጉሜ).
- [ ] Every stored date keeps `{ calendar, precision: 'day' | 'year', originalInput }` so an official record is always reproducible exactly as entered.

## Appendix C — Preference profile (wire format)

```json
{
  "v": 1,
  "fontScale": 1.5,
  "textSpacing": "expanded",
  "surface": "cream",
  "pacing": "one-per-page",
  "audio": "tap",
  "ethsl": "on",
  "easyRead": false,
  "responseModality": "standard",
  "assisted": false,
  "ruler": true
}
```

Encoded as base64url for `?op_prefs=`. Contains **no** diagnosis, no inferred disability, no free text. Versioned; unknown keys ignored; invalid values fall back to defaults rather than erroring.

## Appendix D — Component contract template (docs page)

```
Name · status (draft/stable) · since version
Purpose — the user problem, in one sentence
Do not use when — pointer to the right component
Anatomy — labelled diagram of parts
Annotations — 48px targets, border contrast, focus ring, spacing
States — default, hint, error, disabled (avoid), loading, read-only
Keyboard — full map, per APG pattern
Screen reader — NVDA/NVDA-mobile/TalkBack expected announcements, verbatim
Adaptive behaviour — what changes in Easy-Read / one-per-page / symbol mode / HCM / 400% zoom
Ethiopian behaviour — EC calendar, fidel, patronymic, address specifics (if applicable)
Data contract — value shape, validation codes, review formatting
Accessibility notes — known limitations, honest ones
Code — install, minimal example, props table
```

## Appendix E — Decisions still required (open questions)

| # | Question | Needed by | Owner |
|---|---|---|---|
| Q1 | Which ET-region hosting provider, and does it support managed Postgres + object storage with backup SLA? | Week 1 | Eng C |
| Q2 | Is Savanna's deployment subject to NIDP data-sharing terms that restrict witness attestation? | Week 2 | Counsel |
| Q3 | Do we need Amharic Easy-Read certification from a specific body, or is internal + ENAID review sufficient? | Week 4 | Editor |
| Q4 | What is the consent model for speech audio leaving the device — per-session or one-time? | Week 6 | Counsel + Design |
| Q5 | Does Savanna require the symbol composer's output in a machine-readable accommodation format for employers? | Week 8 | Product |
| Q6 | Who owns the annual HDX COD-AB refresh after launch, and who verifies Amharic admin names? | Week 10 | Lead + content lead |
| Q7 | Is a Savanna-branded build required (white-label tokens + separate CDN), and does it share the same data store? | Week 12 | Lead |
| Q8 | Which two partners take the v1.0 integrations, and do they have engineering capacity to consume npm/WC? | Week 16 | Lead |
| Q9 | Is captions-only acceptable for Savanna's Deaf learners, or is EthSL a hard launch requirement? Who signs that off? | Week 10 (before U1) | Product + Savanna |

---

*Prepared from the OpenPath research report, with external figures re-verified on 13 November 2026. Where this plan contradicts the source report — speech tiering, vendor pricing, DOM isolation, symbol licensing, and data residency — the contradiction is deliberate and sourced.*
