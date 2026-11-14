# Roha - Task Implementation Tracker

**Digital Bridge Hackathon 2026 — Track 1: Accessible Onboarding**  
*Last Updated:* 14 November 2026  
*Status Summary:* **All Core Track 1 P0/P1 Features Implemented & Verified (107/107 tests passing)**

---

## 1. Implemented & Verified Tasks (Track 1 Release)

### Core Product Foundation & Signature Experiences
- [x] **Product Re-branding to Roha:** Visible branding updated across headers, assistant panel, and documentation.
- [x] **Value Proposition Integration:** Embedded value proposition (*"Tell Roha what is stopping you..."*) across UI and assistant.
- [x] **Signature Experience 1: "I'm Stuck":**
  - [x] Implemented situation detector in `ConversationManager.handleImStuck()`.
  - [x] Handles *"I don't understand"*, *"I can't read this"*, *"I don't have that document"*, *"I can't type"*, *"Someone is helping me"*, *"My connection stopped"*, *"I don't want to answer"*.
  - [x] Dedicated UI trigger button (`#roha-btn-stuck`).
- [x] **Signature Experience 2: "Check My Answer":**
  - [x] Implemented formatted read-back in `ConversationManager.getFormattedReviewSummary()`.
  - [x] Partial name correction: *"Keep my first name; change my last name"*.
  - [x] Instant undo: *"Undo that change"*.
  - [x] Spoken digit normalization: Spoken Amharic/English numbers converted to numeric strings.
  - [x] Dedicated UI trigger button (`#roha-btn-check-answer`).
- [x] **Signature Experience 3: "Continue Where I Stopped":**
  - [x] Step index and form values auto-persisted in local outbox draft.
  - [x] Resume recap announced on return (*"Welcome back, we are on step X of Y..."*).
  - [x] Shared-device explanation and erase draft control.

### Embeddable Component & Host Website Isolation
- [x] **Custom Element `<roha-agent>` & `<roha-assistant>`:** Implemented in `app/src/roha/element.ts`.
- [x] **Configurable Attributes:** `language`, `theme`, `form-mode`, `api-endpoint`, `llm-provider`.
- [x] **Lightweight Bundle:** Compiles with esbuild to ~70 KB raw / ~22 KB gzipped (well under the 500 KB ceiling).
- [x] **Scoped Styling:** Scoped CSS classes (`.roha-*`) conforming to strict CSP (`'style-src: self'`).
- [x] **Savanna Host Demonstration:** Live on `/onboard`, `/job`, `/employer`.
- [x] **Independent Blank Host Demonstration:** Implemented in `app/public/blank-host.html` and `demo/blank-host.html`.

### Track 1 Guided Forms & Accessibility
- [x] **One Question Per Screen:** Back and Continue navigation, progress in words (`ደረጃ X ከ Y`).
- [x] **Focus Management:** Programmatic focus shifted to heading/first control on step transition.
- [x] **Identity Routes:** National ID, Refugee ID, Other Document, and No-Document Partner Referral.
- [x] **Successful Referral Route:** Completes successfully and distinguishes local draft from partner sync.
- [x] **Private Support Separation:** Disability / support choices kept strictly local and never leaked to employers.
- [x] **"Prefer Not to Say":** Presented as an equal, stigma-free choice.
- [x] **Microphone Controls:** Prominent microphone button with visible states (`idle`, `listening`, `speaking`, `error`).
- [x] **Reversible Preferences:** Text zoom (100% → 150% → 200%), high contrast dark mode, simple words mode.

### Pluggable Model Provider & LLM Firewall
- [x] **Interface Abstraction:** `LLMProvider` interface in `app/src/roha/providers/llm-provider.ts`.
- [x] **Local Ollama Integration:** Self-hosted `llama3.2:1b` / `qwen3:1.7b` adapter with zero paid API dependencies.
- [x] **Universal Provider Adapters:** OpenAI/Groq, Google Gemini, Anthropic Claude, Chrome Gemini Nano, Generic REST.
- [x] **Dynamic Switching:** `Roha.configureAPI({ provider: '...', ... })` with `localStorage` persistence.
- [x] **Model Safety Firewall:** Model outputs strictly validated against `intent.schema.json` and active target registry. No DOM or script execution.

### Verification & Compliance Evidence
- [x] **Roha Runtime Spec Tests:** 107/107 unit & integration tests passing (`npm run test:roha`).
- [x] **Contract & Traceability Tests:** 20/20 JSON schema assertions passing (`tests/validate_contracts.py`).
- [x] **Automated Accessibility Audit:** 17/17 axe-core audits passing with 0 critical/serious violations (`npm run verify:prod`).
- [x] **Strict CSP Verification:** 0 violations under `nginx-sim` production CSP headers.

---

## 2. Partial Scope (Language Localization)

- [x] **Amharic (`am`):** Assistant response localisation implemented; 27/27 automated browser checks. Native-language review and real-device speech quality remain unverified.
- [x] **English (`en`):** Assistant copy and language switching covered by automated tests. Actual speech availability depends on the browser/device.
- [~] **Tigrinya (`ti`) & Afaan Oromo (`om`):** Language pack architectures and phrase tables mapped; browser synthetic TTS is labeled as unavailable on Linux/Android and falls back to recorded prompts or text.

---

## 3. Intentionally Deferred Post-Hackathon Items (P2 Stretch)

- [ ] **V03 Always-on Background Wake Word:** Foreground button/tap is 100% verified; custom trained on-device keyword detector for "Hey Roha" across locked phone screens is scheduled post-hackathon.
- [ ] **B01 Partner-Assisted Portal Live SSO:** Local consent audit trail is verified; live AAAPD enterprise OAuth/SSO integration is scheduled post-hackathon.
- [ ] **B02 SMS Resume Link Paid Gateway:** Cryptographic zero-PII token dispatch is verified in mock mode; connection to paid telecom SMS gateway (Twilio / Ethio Telecom) is scheduled post-hackathon.
- [ ] **B03 Live Call Center Video Handoff:** Privacy filter (sanitizing Kebele ID/passwords) is verified; connection to WebRTC call center operator queue is scheduled post-hackathon.

