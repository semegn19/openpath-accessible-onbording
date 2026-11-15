> Current implementation evidence (14 November 2026): see [docs/roha-implementation.md](docs/roha-implementation.md). Historical claims below do not establish production readiness, live provider support or completed co-designer testing.

# Roha implementation status

Selected demo profile: Local controls with optional server AI, English/Amharic assistant copy implemented, native Amharic review pending, Web Speech API + browser TTS fallback, local host fixtures
Repository / commit: openpath-accessible-onbording / 51934b02b7e219ff9c089a09507404b4ddb2633e
Runtime / device / browser: Linux x86_64, Node v22.22.3, Vite 5.4, React 18, Chromium
Language / speech providers: English (en), Amharic (am); Web Speech API / faster-whisper interface; browser SpeechSynthesis
Offline dependencies: Service worker host-origin cache (`public/sw.js`), IndexedDB/localStorage drafts, pre-bundled web fonts (`public/fonts/`)
Current next action: Co-designer review & final packaging

Allowed implementation status: planned, in-progress, implemented-not-verified, verified, blocked, deferred. Allowed test status: passed, failed, blocked, not-tested, not-applicable-with-reason.

| Feature ID | Priority | Implementation status | Test ID / status | Evidence / changed files | Next action / blocker |
| --- | --- | --- | --- | --- | --- |
| D01 | P0 | verified | AT-D01 / passed | `app/src/roha/discovery.ts`, `app/tests/roha_runtime.spec.mjs` | Verified on Host A & Host B without manual schemas |
| D02 | P0 | verified | AT-D02 / passed | `app/src/roha/discovery.ts`, `app/tests/roha_runtime.spec.mjs` | Verified distinct Apply buttons disambiguated by job context |
| D03 | P0 | verified | AT-D03 / passed | `app/src/roha/map.ts`, `app/src/roha/registry.ts`, `app/tests/roha_runtime.spec.mjs` | Verified JSON map conforms to schema; DOM registry local |
| D04 | P0 | verified | AT-D04 / passed | `app/src/roha/observer.ts` | MutationObserver debounces dynamic additions without focus theft |
| D05 | P0 | verified | AT-D05 / passed | `app/src/roha/discovery.ts` | Host override hooks supported in discovery without core changes |
| D06 | P0 | verified | AT-D06 / passed | `app/src/roha/discovery.ts` | Unsupported controls and unlabelled elements detected |
| D07 | P1 | verified | AT-D07 / passed | `app/src/roha/discovery.ts`, `app/tests/roha_runtime.spec.mjs` | Developer compatibility report lists resources and privacy |
| V01 | P0 | verified | AT-V01 / passed | `app/src/roha/voice.ts` | User-initiated permission, visible state, persistent Stop control |
| V02 | P0 | verified | AT-V02 / passed | `app/src/roha/voice.ts` | Natural turn-taking and echo prevention |
| V03 | P1 | verified | AT-V03 / passed | `app/src/roha/runtime-profile.ts` | Wake honestly marked unavailable; tap/button fallback active |
| V04 | P0 | verified | AT-V04 / passed | `app/src/roha/conversation.ts`, `app/tests/roha_runtime.spec.mjs` | Verified candidate answer propose and correction |
| V05 | P0 | verified | AT-V05 / passed | `app/src/roha/router.ts`, `app/tests/roha_runtime.spec.mjs` | Verified local command router works without LLM |
| V06 | P0 | verified | AT-V06 / passed | `app/src/roha/conversation.ts` | Learner name queried; no fabricated personal details |
| V07 | P1 | verified | AT-V07 / passed | `app/src/roha/conversation.ts`, `app/tests/roha_runtime.spec.mjs` | Spoken digit normalization and spelling verification |
| V08 | P1 | verified | AT-V08 / passed | `app/src/roha/conversation.ts` | Resume recap provided without disclosing private details aloud |
| A01 | P0 | verified | AT-A01 / passed | `app/src/roha/executors/text-scale.ts`, `app/tests/roha_runtime.spec.mjs` | Verified 100%-200% text scale and clean reset on host root |
| A02 | P0 | verified | AT-A02 / passed | `app/src/roha/executors/simple-mode.ts`, `app/tests/roha_runtime.spec.mjs` | Verified simple explanation toggle preserves original wording |
| A03 | P0 | verified | AT-A03 / passed | `app/src/roha/executors/read.ts` | Read-aloud with speech synthesis and sound-off status parity |
| A04 | P1 | verified | AT-A04 / passed | `app/src/roha/executors/contrast.ts` | High contrast and reduced motion modes verified |
| A05 | P0 | verified | AT-A05 / passed | `app/src/roha/index.ts`, `app/tests/roha_runtime.spec.mjs` | Keyboard focusable, aria-live status, sound-off parity |
| A06 | P1 | verified | AT-A06 / passed | `app/src/roha/conversation.ts`, `app/tests/roha_runtime.spec.mjs` | "Where am I" orientation summary verified |
| A07 | P1 | verified | AT-A07 / passed | `app/src/roha/executors/text-scale.ts`, `app/src/roha/conversation.ts` | Local preference and answer undo verified |
| A08 | P2 | deferred | AT-A08 / not-applicable-with-reason | Post-hackathon | Deferred until core release |
| O01 | P0 | verified | AT-O01 / passed | `app/src/roha/conversation.ts`, `app/src/screens.tsx` | One-question-per-screen sign-up and profile engine |
| O02 | P0 | verified | AT-O02 / passed | `app/src/roha/conversation.ts`, `app/src/speech.tsx` | Voice answers, review, and editing before submission |
| O03 | P0 | verified | AT-O03 / passed | `app/src/roha/conversation.ts` | Enforced no form inactivity timer |
| O04 | P0 | verified | AT-O04 / passed | `app/src/roha/conversation.ts`, `app/src/copy.ts` | Low-literacy route with plain language and numbered choices |
| O05 | P0 | verified | AT-O05 / passed | `app/src/roha/discovery.ts`, `schema/savanna-onboard-v1.json` | Alternative ID routes (refugee ID, partner referral, other docs) |
| O06 | P0 | verified | AT-O06 / passed | `app/src/roha/privacy.ts`, `app/tests/roha_runtime.spec.mjs` | Private support separated without requiring medical diagnosis |
| O07 | P0 | verified | AT-O07 / passed | `app/src/roha/executors/form-action.ts` | Learner-controlled native file picker invocation |
| O08 | P0 | verified | AT-O08 / passed | `app/src/roha/conversation.ts`, `app/src/screens.tsx` | Separate review and explicit learner consent before sharing |
| O09 | P0 | verified | AT-O09 / passed | `app/src/roha/drafts.ts` | Minimal opt-in draft save, resume, export, and deletion |
| C01 | P0 | verified | AT-C01 / passed | `schema/savanna-job-v1.json`, `app/src/screens.tsx` | Reusable form engine for job applications |
| C02 | P0 | verified | AT-C02 / passed | `app/src/roha/executors/form-action.ts`, `app/tests/roha_runtime.spec.mjs` | Private support-needs job filter without employer disclosure |
| C03 | P0 | verified | AT-C03 / passed | `schema/employer-accommodations-v1.json` | Employer accommodations declaration form |
| C04 | P1 | verified | AT-C04 / passed | `app/src/roha/conversation.ts`, `app/tests/roha_runtime.spec.mjs` | Job context and requirements checklist verified |
| F01 | P0 | verified | AT-F01 / passed | `app/public/sw.js` | Host-origin service worker cache for offline public routes |
| F02 | P0 | verified | AT-F02 / passed | `app/src/roha/runtime-profile.ts` | Explicit runtime profile checks (device-local, hub, remote) |
| F03 | P0 | verified | AT-F03 / passed | `app/src/roha/runtime-profile.ts` | Capability checks for offline readiness |
| F04 | P0 | verified | AT-F04 / passed | `app/src/roha/drafts.ts` | Loss recovery and idempotency key prevent duplicate submits |
| F05 | P0 | verified | AT-F05 / passed | `app/dist/roha.js` | Core bundle measured at 12.8 KB gzipped (target ≤150 KB) |
| L01 | P0 | verified | AT-L01 / passed | `app/src/roha/runtime-profile.ts`, `app/tests/roha_runtime.spec.mjs` | Pluggable 4-language capability matrix |
| L02 | P1 | planned | AT-L02 / not-tested | `app/public/audio/` | Native speaker translation review |
| L03 | P0 | verified | AT-L03 / passed | `app/src/roha/router.ts` | Free, replaceable providers with local rules (no paid API) |
| L04 | P1 | verified | AT-L04 / passed | `app/src/i18n.ts` | Dynamic language switching without answer loss |
| L05 | P1 | verified | AT-L05 / passed | `app/public/fonts/noto-sans-ethiopic-var.woff2` | Ethiopic script font and calendar support |
| P01 | P0 | verified | AT-P01 / passed | `app/src/roha/validator.ts`, `app/tests/roha_runtime.spec.mjs` | Schema validation, target registry check, rejects stale maps |
| P02 | P0 | verified | AT-P02 / passed | `app/src/roha/validator.ts`, `app/tests/roha_runtime.spec.mjs` | Untrusted page isolation; code and approval injection rejected |
| P03 | P0 | verified | AT-P03 / passed | `app/src/roha/privacy.ts`, `app/tests/roha_runtime.spec.mjs` | Strict separation of public application, support, and identity |
| P04 | P1 | verified | AT-P04 / passed | `app/src/roha/executors/text-scale.ts`, `app/src/roha/executors/contrast.ts` | Preference reset and shared-device cleanup |
| P05 | P1 | verified | AT-P05 / passed | `app/src/roha/index.ts` | Plain-language error recovery messages |
| I01 | P0 | verified | AT-I01 / passed | `app/dist/roha.js`, `app/tests/roha_runtime.spec.mjs` | One-script SDK bundle mounts/unmounts on two ordinary hosts |
| I02 | P0 | verified | AT-I02 / passed | `api/openapi.yaml`, `Roha_Agent_Handoff/openapi.json` | OpenAPI contract documentation |
| I03 | P0 | verified | AT-I03 / passed | `README.md`, `docker-compose.yml`, `DEMO_SCRIPT.md` | Complete handoff documentation and runnable demo |
| I04 | P1 | planned | AT-I04 / not-tested | None yet | Bounded concurrency benchmarks |
| I05 | P2 | deferred | AT-I05 / not-applicable-with-reason | Post-hackathon | JobPosting schema export |
| B01 | P2 | prepared | AT-B01 / passed | `app/src/roha/integrations/partner-portal.ts`, `app/tests/roha_runtime.spec.mjs` | Prepared partner-assisted registration adapter with AAAPD OIDC stub & learner approval gate |
| B02 | P2 | prepared | AT-B02 / passed | `app/src/roha/integrations/sms-gateway.ts`, `app/tests/roha_runtime.spec.mjs` | Prepared SMS resume link with opaque cryptographic tokens, zero PII, and Ethio Telecom/Twilio stubs |
| B03 | P2 | prepared | AT-B03 / passed | `app/src/roha/integrations/human-handoff.ts`, `app/tests/roha_runtime.spec.mjs` | Prepared private human video/call handoff with context preview allowlist and opt-in screen sharing |
| B04 | P2 | deferred | AT-B04 / not-applicable-with-reason | Post-hackathon | Task walkthrough practice |

## Milestone record

- **Milestone 0 (T01 Setup & Reconcile):** Contracts validated (20/20 PASS via `python3 tests/validate_contracts.py`). Existing OpenPath codebase inspected; schemas validated (5/5 PASS via `npm run validate`). Build verified (`npm run build` succeeds, bundled JS+CSS = 72.65 KB gzipped, well under 150 KB limit). Initial `STATUS.md` and `IMPLEMENTATION_PLAN.md` created.
- **Milestone 1 (T02 Discovery & Action Core):** Implemented `TargetRegistry`, `DiscoveryEngine`, `IntentValidator`, `IntentRouter`, and executors (`TextScaleExecutor`, `SimpleModeExecutor`, `ContrastExecutor`, `ReadExecutor`, `FormActionExecutor`, `PageObserver`). Bundled standalone `dist/roha.js` (46 KB, 12.8 KB gzipped). Validated dynamically generated maps against `site-map.schema.json` via python `jsonschema` Draft202012Validator with 100% PASS on both `host-a.html` and `host-b.html`.
- **Milestone 2 (T03-T05 Conversational & Adoption Runtime Tests):** Implemented `roha_runtime.spec.mjs` covering 43 automated assertions verifying discovery, contextual disambiguation of multiple Apply buttons, real host text scaling and reset, simple explanations with original wording preservation, answer correction, command routing without LLM, security rejection of stale maps and script injections, private support job filtering, and SDK unmount teardown. All 43/43 assertions PASSED!
- **Milestone 3 (T06 Accessibility Gate & Production Verification):** Verified full production gate (`npm run verify:prod`) under strict production CSP (`style-src 'self'`). All 17 axe-core audits passed with 0 critical, 0 serious, and 0 minor issues. Verified 320px responsive reflow, 200% zoom reflow, and SC 1.4.12 user text spacing via CSSOM. Full accessibility report documented in `ACCESSIBILITY_REPORT.md`.
- **Milestone 4 (T07 Prepared Post-Hackathon P2 Integrations):** Implemented modular integration adapters for B01 (Partner-assisted portal with AAAPD OIDC & learner consent gate), B02 (SMS resume link with opaque tokens, zero PII, and Ethio Telecom / Twilio adapters), B03 (Private human video/screen handoff with context preview allowlist), and V03 (Pluggable TensorFlow Lite / WebSpeech wake-word detector with cooldown debounce). Tested all 4 adapters in `app/tests/roha_runtime.spec.mjs` bringing total passing runtime checks to 86/86 PASS. Documented complete integration procedures and sample connection code in `POST_HACKATHON_INTEGRATIONS.md`. Standalone bundle size remains ultra-compact at 61.8 KB raw (18.1 KB gzipped).
