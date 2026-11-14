# Roha (ሮሃ)

**An accessible, conversational sign-up and job-application component for Ethiopian learners and job-seekers.**
*Built for the Digital Bridge Accessibility Hackathon 2026 (Track 1), Addis Ababa (13–15 November 2026).*

> **“Tell Roha what is stopping you. It helps you register and apply for work—even when you cannot understand a question, provide standard ID, or stay connected—while keeping support needs private.”**

---

## 1. Quick Start

Run everything locally with Docker Compose or Node.js:

```bash
# Option A: Run via Docker Compose (Recommended for Judges)
docker compose up -d --build
# → http://localhost:8080/onboard       (Learner Sign-up on Savanna)
# → http://localhost:8080/job           (Career Gateway & Job Application)
# → http://localhost:8080/employer      (Employer Accommodations Form)
# → http://localhost:8080/blank-host.html (Independent Blank Host Demo)

# Option B: Run via Node.js
cd app
npm install
npm run dev
# → http://localhost:5173/onboard
```

---

## 2. The Three Signature Experiences

Roha is designed around three core accessible experiences that remove barriers without stigma:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Roha Signature Experiences                      │
├────────────────────┬──────────────────────────┬────────────────────────┤
│    “I’m stuck”     │    “Check my answer”     │ “Continue where I stopped”
├────────────────────┼──────────────────────────┼────────────────────────┤
│ Understands the    │ Reads back answers in    │ Preserves progress     │
│ learner's barrier  │ full and supports        │ across reloads, tab    │
│ and offers an      │ precise conversational   │ closures, and dropped  │
│ approved, safe     │ corrections:             │ network connections:   │
│ next step:         │                          │                        │
│ • Don't understand │ • “Read all my answers”  │ • Automatic local draft│
│ • Can't read       │ • “Keep my first name;   │   outbox queuing       │
│ • No document / ID │    change my last name”  │ • Spoken resume recap  │
│ • Can't type       │ • “Undo that change”     │ • Shared-device reset  │
│ • Someone helping  │ • Spoken number to digit │   and instant erase    │
│ • Dropped connect  │   normalization          │ • Idempotent sync      │
│ • Private / skip   │                          │                        │
└────────────────────┴──────────────────────────┴────────────────────────┘
```

---

## 3. Embedding Roha on Any Host Website

Roha attaches to an existing page through a script or custom element. Serve `roha.js` and `roha.css` together. One assistant owns the page-wide text and contrast preferences; host CSS compatibility must be checked on the adopting site.

### Drop-in Custom Element:
```html
<!-- The host already contains <main id="application">...</main>. -->
<roha-agent for="application" language="am"
  api-endpoint="/api/assistant"></roha-agent>
<script defer src="/roha.js" data-roha-auto="false"></script>
```

### Two Demonstration Hosts:
1. **Savanna Platform Host:**
   Demonstrates Roha mounted inside Savanna's onboarding and career portal:
   - Learner Onboarding: `http://localhost:8080/onboard`
   - Job Application: `http://localhost:8080/job`
   - Employer Accommodations: `http://localhost:8080/employer`
2. **Independent Blank Host:**
   Demonstrates Roha dropped into a plain, unstyled HTML document with zero external styling or dependencies:
   - Open [demo/blank-host.html](file:///home/welela/Pictures/openpath-accessible-onbording/demo/blank-host.html) or `http://localhost:8080/blank-host.html`.

---

## 4. Change AI providers through the settings interface

Open `/roha-admin.html`, sign in with the administrator token, select **OpenAI, Gemini, Claude, Ollama, or Custom REST**, enter the model and key, then test and save. A connection test makes one small billable request to the selected provider. Models available to your account must be verified with that provider.

Configure `DATA_KEY`, `ROHA_ADMIN_TOKEN` and `ROHA_ADMIN_ORIGIN` on the API server first. Copy the documented variables from [.env.example](.env.example); Node does not load that file automatically. See [deployment and operations](docs/roha-operations.md) for exact commands, PostgreSQL migration, backup and restore.

AI is disabled initially. Learners can use the form, typed local commands and buttons without AI. They must open **AI options** and consent before their typed request reaches a provider. Changing provider settings requires fresh consent. Browser speech recognition has its own browser/vendor privacy behavior and is not sent automatically to this AI gateway.

API keys are stored encrypted on the server. Never put provider keys in HTML, browser storage or `Roha.configureAPI`. The browser only needs the gateway address:

```javascript
Roha.configureAPI({ provider: 'server', endpoint: '/api/assistant' });
```

For an external host, use `data-roha-api="https://your-roha-host/api/assistant"` on the script and allow the host origin in `ROHA_EMBED_ORIGINS`. For Ollama/custom REST, the operator must also allow the exact endpoint URL in `ROHA_AI_ENDPOINTS`. The custom response contract is documented in [the operations guide](docs/roha-operations.md).

---

## 5. Offline Behavior & Clear States

Roha never pretends an action occurred when offline. It communicates three honest states:

1. **`Saved on this device`:** When offline or disconnected, all answers are stored locally in the browser's outbox.
2. **`Waiting to submit`:** Upon completing the review screen while disconnected, the submission is queued with a opaque `clientRef`.
3. **`Submission confirmed`:** When connectivity is restored, the outbox flushes automatically. Idempotent server receipts prevent double-registration.

---

## 6. Privacy & Trust Boundaries

- **Separation of Concerns:** Learner support preferences (screen reader, plain language, assistance needs) are kept strictly local and **never sent to employers** or in public job-matching payloads.
- **Model Firewall:** The LLM NEVER touches the DOM or executes scripts. It can only propose structured JSON intents that are independently validated against `intent.schema.json` and the active page target registry.
- **Voice privacy:** Roha does not retain audio on its API. Browser speech recognition and configured speech providers may process audio remotely; their retention terms need separate verification.
- **Shared Device Security:** Prominent draft dismissal and cache erasure controls ensure that public library or shared community center terminals remain clean.

---

## 7. Verification & Test Commands

Automated checks cover the cases below. They do not replace evaluation with disabled users or real assistive technologies. Run app commands from `app/`:

```bash
# 1. Run all Roha runtime SDK tests (109/109 passed)
npm run test:roha

# 2. Run JSON contract & traceability tests (20/20 passed)
python3 ../Roha_Agent_Handoff/tests/validate_contracts.py

# 3. Run production verification (17 axe-core audits, 0 serious/critical, strict CSP)
npm run verify:prod

# 4. Run offline outbox verification
npm run offline
```

---

## 8. Limitations & Conformance Notes

- **Background Wake Word:** Always-on wake listening across locked mobile screens is deferred post-hackathon (requires a trained keyword spotting model). Foreground tap-to-talk is primary and fully verified.
- **Language Scope:** Amharic (`am`) and English (`en`) are available in the main form UI. Assistant responses and settings have Amharic copy; native-speaker review is still required, and speech support depends on the device/provider. Tigrinya and Afaan Oromo are not release-ready.
- **Screen Reader Evaluation:** Automated axe-core scans show 0 issues. Manual co-designer testing with NVDA and TalkBack has not been completed or scheduled here.


## 9. Implementation and release status

The baseline gate defects were repaired; the assistant now has typed input, a keyboard-operable dialog, visible responses, consent-controlled server AI, administrator settings, and a working declarative plugin lifecycle. PostgreSQL supports encrypted records, durable idempotency, shared configuration, sessions and usage budgets across API workers. The explicit production deployment profile rejects missing encryption, storage or HTTPS configuration.

Run `npm run test:settings`, `npm run test:access`, and `npm run test:roha` from `app/`, plus `npm test` from `api/`. With a disposable PostgreSQL server, set `TEST_DATABASE_URL` and run `npm run test:database` and `npm run test:replicas` from `api/`.

**This is not a claim of production certification or support for every disability.** Live provider tests, real NVDA/TalkBack/switch-access sessions, native-language review, a deployment restore rehearsal and an organisation pilot remain release gates. See [implementation evidence and pending work](docs/roha-implementation.md).
