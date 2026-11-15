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

## Status, honestly

| | |
|---|---|
| ✅ Built and tested | 3 form pages · 4 languages (Amharic, Afaan Oromoo, Tigrinya, English) · Multi-provider AI speech-to-text (Addis AI, Gemini, Ollama, OpenAI) · All 3 Integration Levels (L1 Script-tag embed, L2 REST + OpenAPI 3.1, L3 schema.org JSON-LD) · SMS resumption links · Docker Compose |
| ✅ Automated evidence | 17 axe audits at zero serious/critical · 43 API assertions · 10 embed assertions · 37 JSON-LD assertions · 18 AI adapter assertions · 28 voice assertions · 22 offline assertions · zero third-party requests · 0 schema errors |
| ⚠️ Needs a human | Live co-designer sessions (NVDA, TalkBack, keyboard-only, 200% zoom, sound off) on judging day — see [Limitations](#limitations) |
| 📋 Post-hackathon | LTI 1.3 LMS deep linking · admin analytics UI · long-term data retention policy |

Everything claimed below has a command you can run to check it.

---

## Why this exists

Ethiopia's Digital Bridge survey (21 October 2026) found the things you would expect, and one that is worse:

- **Forms time out** while people are still reading them.
- **Help is English only**, in a country where most people's first language is not.
- **Videos have no captions and no sign language.**
- **Job boards break under a screen reader** — the page exists, but nothing in it is reachable.

None of that needs new science. It needs forms that ask one thing at a time, in the learner's own language, with the keyboard, at 200 % zoom, with the sound off.

## What it does

Three forms, three URLs, one engine. Each page stands alone — linkable, bookmarkable, embeddable.

| Page | URL | Who it is for |
|---|---|---|
| **Learner sign-up** | `/onboard` | a student joining Savanna, with or without an ID document |
| **Apply for a job** | `/job` | the career gateway, same engine |
| **Employer sign-up** | `/employer` | an employer committing to accommodations |

### The flow (learner sign-up)

```
language → accessibility preferences → name → phone
        → identity route ─┬─ Fayda ID → Fayda ID number ─────────────┐
                          └─ Kebele ID / Refugee / Other → Photo upload ─┴→ review → submit
```

**One question per screen**, no time limit anywhere.

- **Language first.** Amharic, Afaan Oromoo, Tigrinya, or English, chosen before anything else, changeable at any moment from the bar at the top.
- **Accessibility preferences.** *How would you like this form to work for you?* — read aloud, bigger text, simple words. These **act**: choosing one changes the form immediately, and **never leave the device**.
- **Four identity routes.**
  - *Fayda ID* — conditional next step asks for their Fayda ID number.
  - *Kebele ID*, *Refugee ID*, or *Other document* — conditional next step asks for an ID photo upload, with automatic client-side image compression (HTML5 Canvas) to keep payloads lightweight and preserve privacy without requiring database storage.
- **Connection Drop SMS Resume.** If connection drops while filling the form, an SMS resume link is automatically dispatched via SMSEthiopia (`https://smsethiopia.com`) to their entered phone number, allowing them to resume exactly where they left off.
- **Review and edit** before submitting. Every answer is visible, editable, and never re-typed.
- **Voice on every field.** Speak your answer, see what was heard, correct it, then accept. Nothing is ever written into the form without that extra press.

---

## The five gate conditions

The hackathon gate is pass/fail and comes before scoring. Here is where each one stands.

| Gate condition | How it is met | Evidence |
|---|---|---|
| **Completes unaided with NVDA** | one question per screen · `<h1>` is the question · fieldset groups named by `aria-labelledby` · label→hint→error order · error summary in the GOV.UK pattern · live regions for silent changes | ⚠️ automated + structural; **co-designer run pending** |
| **…and TalkBack** | full-viewport 52 px targets · no hover-only content · native controls only | ⚠️ pending a device run |
| **Keyboard only** | skip link → settings → question → Continue. No traps, no drag, nothing mouse-only | ✅ `tests/kb.mjs`, `tests/focus-obscured.mjs` |
| **200 % zoom** | reflow at 320 CSS px with no horizontal scroll; sticky bar capped and scroll-padded so it never covers focus | ✅ `tests/a11y.spec.mjs` (320 px), `tests/focus-obscured.mjs` |
| **Sound off** | read-aloud is an addition, never load-bearing. Every audio prompt has on-screen text | ✅ whole flow runs muted |
| **axe-core zero critical/serious** | 14 audits across every screen, tags `wcag2a 2aa 21a 21aa 22aa` | ✅ **14/14, 0 serious, 0 critical** |
| **WCAG 2.2 AA report** | [`docs/wcag-2.2-aa-conformance.md`](docs/wcag-2.2-aa-conformance.md) — 55 criteria, one row each, with the test that proves it | ✅ **55/55 supported, 0 failures**; co-designer sign-off pending |

---

## Accessibility

### What it satisfies

Only what we tested. "Verified" means a script or a screenshot in this repo shows it.

| WCAG 2.2 criterion (AA) | How | Status |
|---|---|---|
| **1.4.3** Contrast (minimum) | every text pair ≥ 4.5:1; Savanna's brand colours adjusted, not replaced | ✅ measured |
| **1.4.10** Reflow | 320 CSS px, no horizontal scrolling (400 % zoom on a 1280 px screen) | ✅ |
| **1.4.11** Non-text contrast | 2 px borders at 5.80:1; selected state = border + tint, never colour alone | ✅ |
| **1.4.4** Resize text | all sizes in `rem`; "Bigger text" adds 50 % on top of browser zoom (1rem → 1.5rem) | ✅ |
| **2.1.1 / 2.1.2** Keyboard, no trap | every control reachable and operable; skip link first | ✅ |
| **2.4.3** Focus order | bar → question → options → Continue, matching reading order | ✅ `tests/kb.mjs` |
| **2.4.7** Focus visible | 3 px outline, offset, never removed | ✅ |
| **2.4.11** Focus not obscured | sticky bar measured at runtime, `scroll-padding-top` follows it | ✅ `tests/focus-obscured.mjs` at 400 px viewport height |
| **2.2.1** Timing adjustable | there is no timer anywhere in the product | ✅ |
| **2.5.8** Target size | 52 px options, 48 px buttons — double the 24 px minimum | ✅ |
| **3.3.1** Error identification | plain sentences: *"That phone number does not look right. Example: 0912345678"* | ✅ |
| **3.3.3** Error suggestion | every message says what to do, not what went wrong | ✅ |
| **3.3.7** Redundant entry | review screen keeps every answer; nothing is re-typed | ✅ |
| **4.1.2** Name, role, value | native elements; `aria-pressed`, `aria-invalid`, `aria-describedby` | ✅ |
| **4.1.3** Status messages | language change, support toggles, "a new question was added" | ✅ `tests/announce.mjs` |
| **1.2.1–1.2.5** Media alternatives | no video, no audio-only content | n/a |
| **1.3.1** Info and relationships | one `<h1>` per screen, real `<fieldset>`/`<dl>`, no div-soup | ✅ |

**Three findings worth naming**, because they are the kind a rubric asks about:

1. **Emoji were rendering as tofu boxes.** They were the only icon on the low-literacy path. Replaced with inline SVG (`currentColor`, `aria-hidden`).
2. **The Ethiopic font was subset to our own strings**, so a learner's name or a voice transcript could render as `⯑`. Fixed by shipping all **384 assigned Ethiopic codepoints** (one 136 KB variable file) and a test that fails if any stop rendering.
3. **The sticky settings bar ate 287 px of a 400 px viewport** and covered the question it was meant to help with. Rebuilt as compact toggles, capped at `40dvh`, with measured `scroll-padding-top`.

### Colour, and what we did to Savanna's brand

The palette is Savanna's. Four of their colours fail WCAG, so each is **adjusted to the minimum passing step** rather than swapped out:

| Use | Colour | Contrast | |
|---|---|---|---|
| Navy — structure, buttons | `#002b56` | **14.19:1** | brand, unchanged |
| Red — error borders, bars, icons | `#db3e3e` | **4.40:1** | brand, unchanged (passes 3:1 for non-text) |
| Red — error *text* | `#cf3636` | **4.53:1** | 3 % darker; the minimum shift that carries text |
| Grey — hints, second-level text | `#5f6670` | **5.80:1** | their `#98a3ae` (2.57:1) was unusable |
| Green — success | `#028749` | **4.60:1** | their `#05f283` is 1.50:1 and is never used for text or focus |

Error hierarchy is deliberate: **red carries the error, navy carries the structure**, so red reads as *something is wrong* rather than decoration.

---

## Privacy

> **Nothing about a person's disability or health is ever asked for, and there is no field to put it in.**
>
> Two different things used to be one field. Now:
> - **How the form should work for you** (read aloud, bigger text, simple words) is `localOnly` — it never leaves the device.
> - **Whether you want a person to help you** is a request, so it *is* sent: your name and phone number go to a partner organisation, with an explicit yes and a disclosure before the choice. Nothing about your health or disability goes with it.

That is not a policy sentence. Each layer is enforced and each one is tested.

| Layer | What it does | Test |
|---|---|---|
| **Client** | `localOnly` steps are dropped before the payload is built | `tests/a11y.spec.mjs` asserts the payload has no `accessibility-prefs` key |
| **Server** | refuses to store accommodation fields even if a client sends them, and reports back what it dropped: `"stripped": ["support"]` | `tests/api.mjs` |
| **Disk** | the test then greps the data file to prove `large-text` / `read-aloud` never landed there | `tests/api.mjs` |

Any key named `medical`, `disability` or `diagnosis` is dropped whether or not the schema declares it — a client that invents a field still cannot get it stored.

### Other commitments

- **Zero third-party requests.** Every page load is same-origin: fonts self-hosted, no analytics, no CDN, no tag manager. Verified: `npm run hosts` prints the only host contacted.
- **No cookies. No tracking. No advertising identifiers.**
- **One `localStorage` key per form**, holding an in-progress draft so a lost connection does not lose answers. Cleared on submit.
- **Submissions are readable only with an unguessable id** (`sub_` + 12 random bytes). There is no list endpoint and no search — an attacker cannot enumerate what they do not already hold.
- **Nothing is sent until the user presses the final button**, and then the screen says exactly what happened.

### Data at rest

A name, a phone number and a **national ID number** are personal data. Set `DATA_KEY`
(32 bytes, base64) and those answers are encrypted with **AES-256-GCM** before they reach
`submissions.jsonl`; the API decrypts them for a caller holding the id. Without the key the
server starts with a loud warning and stores plaintext — fine on a laptop, not on a server.

```bash
export DATA_KEY=$(head -c 32 /dev/urandom | base64)
```

**What this does not protect:** `GET /api/submissions/{id}` has no authentication, so the
unguessable id is still the only control on a live record, and an operator with the key can read
everything. Encryption at rest protects a stolen file or a leaked volume. It is not a substitute
for access control — see [Limitations](#limitations).

### Slow connections, and no connection

The target phone is a 3G Android that loses signal on a minibus. Two failures matter, and both
were real in this code before they were fixed:

**1. The form deleted the answers, then tried to send them.** `submit()` removed the saved draft
and *then* started the POST. When the POST failed, the screen said *"your answers are saved on
this device"* about answers that had already been deleted — close the tab and the sign-up was
gone. Now the order is the reverse and it is not negotiable:

```
enqueue to the device  →  clear the draft  →  try to send  →  retry until it lands
```

Every attempt carries one `clientRef`. The API treats a repeat of that ref as the same
submission and answers `200` with the original receipt instead of writing a second record
(`idempotency` in `api/server.mjs`). That is what makes retrying safe: **a lost response cannot
register somebody twice** — or get them called twice by a partner organisation.

**2. Offline, the phone could not even open the page.** "Saved on this device" is worthless if a
reload shows the browser's dinosaur. A small service worker (`public/sw.js`, production only)
keeps the shell, the CSS and the fonts — including the 136 kB Ethiopic face — so the form opens
with no signal at all. It never caches `/api/`.

| On a 400 kbit/s link (Chrome's Slow 3G) | Result |
|---|---|
| First visit → usable first question | **351 kB, 8.1 s** (`npm run offline` measures this every run) |
| Second visit → usable first question | **0 kB, 117 ms** |
| Reload with no connection at all | app opens, draft restored |
| Submit with no connection | queued, banner says so, reference number appears once it lands |
| Connection returns | it sends itself; also on app load and when the tab becomes visible |

What it does **not** protect, stated plainly:

- `navigator.onLine` is a hint, not the truth (a captive portal says "online" and drops packets).
  The banner follows that hint; the *queue* follows the actual send result, which is why the two
  can disagree for a second or two.
- If the phone clears site data, or the user picks "start again" or uses private mode, the queued
  sign-up is gone. Storage on the device is the only copy until the server acknowledges it.
- The worker serves the HTML **network-first** on purpose: a cached shell is a stale demo. It only
  falls back to cache when the network fails.
- One sign-up at a time per form. A queue depth is a queue nobody will look at.

### One disclosure we will not bury

**Voice input uses the browser's speech recognition.** In Chrome that is typically a cloud service — the recording of the user's voice may be processed by the browser vendor. We do not record, store or forward it ourselves, and it only happens when the user presses the microphone button. **Typing is always available and never gated.** We say this plainly because a privacy claim with an asterisk is how people end up trusting the wrong thing.

---

## Quick start

### Docker (the way judges will run it)

```bash
docker compose up -d --build     # → http://localhost:8080/onboard
```

Two containers, no database, no secrets, no API keys:

- `forms` — nginx serving 360 KB of static files
- `api` — a ~340-line Node service, zero dependencies, storing one append-only JSONL file

### Local development

Copy that is not a form question — status, connectivity, the microphone's error messages,
the date field's labels — lives in `schema/runtime-copy-v1.json`, not in each form's `ui`
block, because all three forms share it. It is validated for missing languages and for
mismatched `{placeholders}`, and `tests/copy-source.mjs` fails if a key is used but
undeclared or declared but unused. Nothing else may hardcode a UI string.

```bash
# schema/*.json is the only source of truth. app/src/schemas/ is generated from it by
# `npm run sync:schemas`, which runs automatically on predev, prebuild and precheck —
# so a fresh clone has no schema files under app/src/ until you start something.
cd app && npm ci
npm run dev          # http://localhost:5173/onboard
npm run api:dev      # optional, in a second terminal: the API on :8080
```

Vite proxies `/api` to `:8080`. **If the API is not running the form still works** — it says *"Saved on this device"* instead of pretending. That is a supported deployment, not an error state: Level 1 of the adoptability ladder is plain static files.

### Plain static hosting

```bash
cd app && npm run build     # → app/dist
```
Serve `dist/` with **one rewrite rule**, or a hard refresh on `/job` is a 404:

```nginx
location / { try_files $uri /index.html; }
```

---

## Integration Levels (Adoptability Ladder)

The hackathon brief requires the onboarding module to support integration via:
1. **Level 1: Drop-in Script Tag (`embed.js`)**
2. **Level 2: REST API with an OpenAPI 3.1 specification**
3. **Level 3: An open industry standard (`schema.org/JobPosting` JSON-LD)**

All three levels are built, documented, and asserted in automated test suites.

### Level 1 — Drop-in Script Tag Embed

Any external host page (e.g. Savanna portal, university LMS, or government service) can embed OpenPath using **one script tag**:

```html
<!-- 1. Provide an optional container -->
<div id="openpath-signup"></div>

<!-- 2. One script tag to load and render -->
<script src="https://openpath.example.et/embed.js"
        data-form="onboard"
        data-lang="am"
        data-target="#openpath-signup"
        data-title="የተማሪ ምዝገባ ቅጽ">
</script>
```

- **Live Demo Page**: Open [`/embed-demo.html`](http://localhost:8080/embed-demo.html) in your browser to test the script tag integration live with real-time postMessage event logging and interactive controls.
- **Contract & Spec**: Full specification is documented in [`docs/embed-contract.md`](docs/embed-contract.md).
- **Zero Inner Scrollbars**: Dynamic bidirectional `postMessage` protocol automatically resizes the iframe to match content height.
- **Microphone Delegation**: Sets `allow="microphone"` permissions policy so voice input works seamlessly across iframe boundaries.
- **Automated Evidence**: Tested in `app/tests/embed.mjs` against a host page on a separate port with Playwright and axe-core (10 assertions, 0 violations).

### Level 2 — REST API & OpenAPI 3.1

A zero-dependency Node.js service (`api/server.mjs`) backed by append-only crash-safe JSONL storage, with optional AES-256-GCM encryption at rest (`DATA_KEY`). Full interactive spec at [`/api/openapi.yaml`](http://localhost:8080/api/openapi.yaml).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | `GET` | Liveness, forms count, submission count, encryption & ASR status |
| `/api/forms` | `GET` | List available form definitions |
| `/api/forms/{id}` | `GET` | Full schema definition for client-side rendering |
| `/api/submissions` | `POST` | Validate and store submission, return receipt ID |
| `/api/submissions/{id}` | `GET` | Read back submission by unguessable ID |
| `/api/checkpoints` | `POST` | Save 7-day progress checkpoint, return resume token and URL |
| `/api/checkpoints/{token}` | `GET` | Retrieve saved answers to resume filling |
| `/api/sms/send-resume` | `POST` | Dispatch resume link via SMS (Ethio Telecom / Safaricom) |
| `/api/transcribe` | `POST` / `GET` | Multi-provider speech-to-text (Addis AI, Gemini, Ollama, OpenAI) |
| `/api/transcribe/config` | `GET` | Inspect active ASR providers and supported languages |
| `/api/openapi.yaml` | `GET` | OpenAPI 3.1 specification document |

```console
$ curl -s -X POST localhost:8080/api/submissions -H 'Content-Type: application/json' -d '{
    "formId": "savanna-onboard-v1",
    "answers": { "language":"am", "name":"ሳራ ተስፋዬ", "phone":"0912345678",
                 "id-route":"refer", "submit":["consent-programme"] }
  }'
{"id":"sub_9mQ2xT7bK1vR4pLz","receivedAt":"2026-11-15T09:41:02.114Z","stripped":[]}
```

- **Server-Side Validation**: The server re-validates every field against schema rules (`phone-et`, `required`, etc.), returning translated error rule names.
- **Privacy Guarantee**: Fields marked `localOnly` (`accessibility-prefs`) are automatically stripped before writing to disk and returned in `stripped[]`.
- **Automated Evidence**: Tested in `app/tests/api.mjs` (43 assertions) and `app/tests/transcribe.mjs` (11 assertions).

### Level 3 — Standards-Based Integration (`schema.org/JobPosting` JSON-LD)

OpenPath implements the **W3C / Schema.org standard** for structured job data, allowing search engines, job aggregators, and assistive platforms to discover accommodation-friendly employment opportunities:

- **REST Endpoints**:
  - `GET /api/forms/employer-accommodations-v1/jsonld?lang=am`: Generates structured `schema.org/JobPosting` from form schemas.
  - `GET /api/submissions/{id}/jsonld`: Generates structured `schema.org/JobPosting` from submitted employer commitments.
- **DOM Injection**: On `/employer`, a `<script id="openpath-jsonld" type="application/ld+json">` tag is reactively maintained in the document head and cleanly removed on navigation.
- **Strict Privacy**: Contact phone numbers, applicant answers, and accessibility preferences are guaranteed 100% excluded from the public JSON-LD graph.
- **Automated Evidence**: Tested in `app/tests/jsonld.mjs` (37 assertions).

---

## Add a fourth form — no code

A form is a JSON file. That is the whole adoption story.

1. Copy `schema/savanna-onboard-v1.json` to `schema/your-form.json`, change `id`, `title`, and `steps`.
2. `npm run validate` — the validator checks structure, Amharic/English completeness, and flag consistency.
3. Add one line to `PAGES` in `app/src/App.tsx`, and a route in the API's schema directory (copy happens automatically at build).

Step types available: `text · tel · email · number · textarea · select · radio · checkbox · file · date-ec-gc · language · statement · review · submit` — 11 input types and 3 screens, all with voice, error handling and Amharic support already wired.

---

## Architecture

```
schema/            the single source of truth: 3 forms + validator (0 errors, 0 warnings)
  validate.mjs     structural checks, E07/E21/W08 rules, language parity
api/
  server.mjs       REST API — 4 endpoints, zero dependencies, JSONL store
  openapi.yaml     OpenAPI 3.1
app/
  src/App.tsx      routing, focus management, step renderer, submit → API
  src/fields.tsx   the field shell: label → hint → control → error, for every type
  src/speech.tsx   read-aloud + voice input with confirm-before-accept
  src/digits.ts    spoken digits → a usable phone number ("ዘጠኝ አንድ አንድ" → 911)
  src/icons.tsx    inline SVG icons (currentColor, aria-hidden)
  src/styles.css   Savanna theme + every audited contrast decision, in comments
  public/fonts/    Poppins + Noto Sans Ethiopic, 152 KB, self-hosted, OFL
tests/             13 Node scripts + 1 Python — see Testing
docs/
  wcag-2.2-aa-conformance.md  **the conformance report** — 55 criteria, one row each, with evidence
  a11y-field-matrix.md   7 disability groups × every field, with checkboxes and evidence log
  schema-audit-review.md adjudication of the external schema audit
  fix-plan.md            the plan this implementation followed
  parallel-build-plan.md **3-person split**: what the code lacks, file ownership, 2-day calendar
  low-literacy-copy-spec.md how to write simple words + icons, with the measured state
  amharic-voice.md       **why read-aloud is pre-recorded**: Android has no Amharic TTS
  audio-generation.md    generating missing clips once with the adopter's key (no database needed)
  integration-levels.md  L1 script tag · L2 REST+OpenAPI (done) · L3 standard — status and effort
  backlog.md             **everything still open**, P0 → P2, with acceptance tests
  audio-recording-list.md generated: the 158 clips, their file names, their text
docker-compose.yml      nginx + API
```

**Sizes:** 64 kB gzipped JS · 2.3 kB CSS · 152 kB fonts (the Ethiopic face covers the whole block, on purpose). First visit on a 400 kbit/s link: **351 kB, 8 s to the first question**; second visit: **0 kB, 117 ms** — it comes out of the offline cache.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | API port |
| `DATA_DIR` | `api/data` | where `submissions.jsonl` lives |
| `SCHEMA_DIR` | `schema/` | which form definitions the API accepts |
| `RATE_LIMIT_PER_MIN` | `30` | submissions per IP per minute |
| `MAX_BODY_BYTES` | `32768` | request body cap (32 KB) |
| `ALLOWED_ORIGIN` | `*` | CORS. Narrow it if you deploy publicly |
| `TRUST_PROXY` | `1` | read `X-Forwarded-For` when behind nginx |
| `DATA_KEY` | *(unset)* | 32-byte base64 key. Encrypts names, phones and ID numbers at rest. **Set this in production.** |
| `ADDIS_AI_API_KEY` | *(unset)* | Addis AI key for Ethiopian speech recognition (`am`, `om`, `ti`) and text-to-speech |
| `GEMINI_API_KEY` | *(unset)* | Google Gemini key for multilingual audio transcription (`am`, `om`, `ti`, `en`) |
| `OLLAMA_HOST` | *(unset)* | Self-hosted Ollama endpoint (e.g. `http://localhost:11434`) for offline/local AI models |
| `AI_PROVIDER` | `auto` | Preferred AI provider: `auto`, `addis-ai`, `gemini`, `ollama`, `openai-compatible`, `mock` |
| `ASR_URL` | *(unset)* | OpenAI-compatible Whisper endpoint (e.g. `http://127.0.0.1:8080/inference` for `whisper.cpp`) |
| `ASR_KEY` | *(unset)* | Bearer key for `ASR_URL`, if the engine needs one |
| `ASR_MODEL` | `whisper-1` | Model name passed to the engine |
| `MAX_AUDIO_BYTES` | `2097152` | Largest recording accepted by `/api/transcribe` (2 MB ≈ 30 s of audio) |
| `SMS_KEY` | *(unset)* | SMSEthiopia API key for connection-drop recovery SMS |
| `SMS_SIMULATE` | `false` | When `true`, simulates SMS delivery without sending live carrier SMS |

---

## Testing

```bash
cd app
npm run check        # runs the full verification gate
```

| Command | Proves |
|---|---|
| `npm run embed` | **Level 1 Embed**: `<script src="embed.js">` iframe loader on separate host port, postMessage protocol, auto-resize, microphone delegation, axe clean |
| `npm run api` | **Level 2 REST**: 43 assertions — contract, validation, privacy stripping, **encryption at rest**, idempotent retries, rate limit, OpenAPI 3.1 parity |
| `npm run jsonld` | **Level 3 Standard**: 37 assertions — `schema.org/JobPosting` JSON-LD generation from schemas and submissions, reactive DOM injection, strict zero PII |
| `npm run ai` | **Multi-Provider AI**: 18 assertions — provider discovery, language auto-routing, fallback on upstream failure, mock engine |
| `npm run target-size` | **WCAG 2.5.8**: all buttons, radio/checkbox inputs, settings chips meet or exceed 24×24px (and 48px touch targets) |
| `npm run sms` | **SMS & Recovery**: phone normalization, checkpoint endpoints, SMS resume links, and offline drop recovery |
| `npm run transcribe` | ASR endpoint behaviour: 503 unconfigured, real transcript, 415/413, and browser fallback |
| `npm run validate` | schemas compile: **0 errors, 0 warnings** |
| `npm run a11y` | **17 axe audits**, 0 serious/critical · error state · 320 px reflow · no mic on consent · payload privacy · **200 % zoom** |
| `npm run pages` | `/onboard`, `/job`, `/employer` · deep links · skip link · back button (21 checks) |
| `npm run controls` | **all three forms** walked to the end: read-aloud on every screen, microphone on every answering screen, none on consent |
| `npm run literacy` | simple-mode walk: renders every screen, flags noun-only headings (`--strict` fails on them) |
| `npm run offline` | **22 assertions** — Slow 3G budget, a draft that survives a reload with no signal, reconnect flush |
| `npm run submit` | form → API → stored record; and the no-API path that refuses to lie |
| `npm run voice` | spoken Amharic digits → `911234567`; "a new question was added" announcement |
| `npm run focus` | nothing focused is hidden under the sticky bar (2.4.11) |
| `npm run hosts` | **zero third-party requests** |
| `npm run copy` | hardcoded string ceiling check (`CEILING = 37`) |
| `npm run audio:check` | static audio manifest coverage and provenance check |
| `npm run verify:prod` | the *built* bundle behind nginx semantics: routing, 17 axe audits, CSP with no violations |
| `python3 tests/font-coverage.py` | all 384 assigned Ethiopic codepoints still render |

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
