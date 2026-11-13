# OpenPath

**Accessible online forms for Ethiopian learners and job-seekers — one engine, three forms, an Amharic-first interface, and a privacy rule you can test.**

Built for the **Digital Bridge Accessibility Hackathon 2026**, track 1 (accessible onboarding), Addis Ababa, 13–15 November 2026.

```bash
git clone <this repo> && cd <this repo>
docker compose up -d --build
# → http://localhost:8080/onboard   ·   /job   ·   /employer
```

---

## Status, honestly

| | |
|---|---|
| ✅ Built and tested | 3 form pages · Amharic + English · voice input on every field · REST API + OpenAPI 3.1 · Docker Compose |
| ✅ Automated evidence | 17 axe audits at zero serious/critical · 41 API assertions · 22 offline assertions · 21 page checks · zero third-party requests · 0 schema errors |
| ⚠️ Needs a human | NVDA / TalkBack / keyboard-only runs **with the co-designer** — not yet done, see [Limitations](#limitations) |
| ❌ Not built | Level 1 script-tag embed · Level 3 standards (LTI 1.3, JobPosting, Open Badges) · admin UI · data retention policy |

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
language → how should this form work for you? → would a person help? → name → phone
        → identity route ─┬─ ID number ────────┐
                          └─ no document / help me choose ─┴→ referral consent → review → submit
```

**One question per screen**, no time limit anywhere.

- **Language first.** Amharic or English, chosen before anything else, changeable at any moment from the bar at the top.
- **Then two separate questions**, because they are not the same kind of thing:
  - *How would you like this form to work for you?* — read aloud, bigger text, simple words. These **act**: choosing one changes the form immediately, and **never leave the device**.
  - *Would you like a person to help you?* — a real request, with an explicit yes/no, that **is** sent so somebody can call. A help button that reaches nobody is worse than no help button.
- **Six identity routes**, including *"I do not have any of these"* and *"I need help choosing"* — because not everyone has a Fayda number, and a form that only accepts one document is a form that turns people away.
- **Consent is never dictated.** The referral and confirmation screens have no microphone — a transcription must never look like consent. They do have read-aloud, because that is the one screen where hearing the words matters most.
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

```bash
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

## The API (Level 2)

Base: `/api`. Full spec: **`api/openapi.yaml`** (OpenAPI 3.1, clean under `openapi-spec-validator`), also served live at `GET /api/openapi.yaml`.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | liveness, forms, submission count |
| `GET /api/forms` | which forms this deployment accepts |
| `GET /api/forms/{id}` | the full form definition — the renderer's input |
| `POST /api/submissions` | validate, store, return an id |
| `GET /api/submissions/{id}` | read one back |

```console
$ curl -s -X POST localhost:8080/api/submissions -H 'Content-Type: application/json' -d '{
    "formId": "savanna-onboard-v1",
    "answers": { "language":"am", "name":"ሳራ ተስፋዬ", "phone":"0912345678",
                 "id-route":"refer", "submit":["consent-programme"] }
  }'
{"id":"sub_9mQ2xT7bK1vR4pLz","receivedAt":"2026-11-15T09:41:02.114Z","stripped":[]}
```

**The server re-validates everything** against the same JSON the form renders from, and returns the *same rule names* the UI already translates:

```json
{"error":{"code":"invalid","fields":[{"field":"phone","rule":"phone-et"}]}}
```

Rate limit 30/min per IP · bodies capped at 32 KB · `Cache-Control: no-store` · CORS open so the form can be embedded.

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
| `MAX_BODY_BYTES` | `32768` | request body cap |
| `ALLOWED_ORIGIN` | `*` | CORS. Narrow it if you deploy publicly |
| `TRUST_PROXY` | `1` | read `X-Forwarded-For` when behind nginx |
| `DATA_KEY` | *(unset)* | 32-byte base64 key. Encrypts names, phones and ID numbers at rest. **Set this in production.** |

---

## Testing

```bash
cd app
npm run check        # everything below, in about 60 s
```

| Command | Proves |
|---|---|
| `npm run validate` | schemas compile: **0 errors, 0 warnings** |
| `npm run a11y` | **17 axe audits**, 0 serious/critical · error state · 320 px reflow · no mic on consent · payload privacy · stale-answer check · offline banner · **200 % zoom** |
| `npm run pages` | `/onboard`, `/job`, `/employer` · deep links · old `#/` links · skip link · back button (21 checks) |
| `npm run api` | **41 assertions** — contract, server-side validation, privacy stripping, **encryption at rest**, **idempotent retries**, rate limit, 413/415, spec parity |
| `npm run offline` | **22 assertions** — Slow 3G budget, a draft that survives a reload with no signal, submit-with-no-connection, reconnect flush, one record on disk |
| `npm run submit` | form → API → stored record; and the no-API path that refuses to lie |
| `npm run voice` | spoken Amharic digits → `911234567`; "a new question was added" announcement |
| `npm run kb` | 14-stop tab order |
| `npm run focus` | nothing focused is hidden under the sticky bar (2.4.11) |
| `npm run hosts` | **zero third-party requests** |
| `npm run verify:prod` | the *built* bundle behind nginx semantics: routing, 17 axe audits, CSP with no violations |
| `python3 tests/font-coverage.py` | all 384 assigned Ethiopic codepoints still render |

---

## Limitations

Written by the people who built it, so nobody discovers them on stage.

1. **No co-designer run yet.** NVDA, TalkBack and a real screen-reader walkthrough are **not done**. Every structural safeguard is in place and tested; the human verification is the one thing a script cannot do. IT IS THE NEXT THING WE DO.
2. **Switch access, voice control and braille displays are untested** — no hardware.
3. **The API has no authentication and no admin UI.** Submissions are write-only for the public and readable only by id. An operator reads the JSONL file.
4. **No retention or deletion policy.** `api/data/submissions.jsonl` grows forever. Production needs a cron rotate plus a deletion request path — one line of documentation, not one line of code.
5. **Level 1 script-tag embed is not built.** The app can be iframed today (`frame-ancestors *` in the nginx CSP); the `<script>` one-liner is not written.
6. **Level 3 is not built.** A `schema.org/JobPosting` mapping for `/job` and an LTI 1.3 launch are the obvious next steps and neither exists.
7. **`docker compose up` has not been executed** — there is no Docker daemon in the build environment. The config is lint-checked and the bundle is proven behind nginx semantics (`npm run verify:prod`), but the first real `up` is yours.
8. **`file` and `date-ec-gc` field types exist but no live form uses them.** Do not demo them.
9. **The job and employer forms do not yet ask language first,** and their preference steps are not split the way the learner form's are. The learner form is the one the gate is judged on.
10. **A queued sign-up lives only on that phone.** Clear site data and it is gone. There is no server-side draft sync, because a draft on a server is a draft with the same privacy cost as a submission and none of the consent.
11. **The offline cache is per-browser.** A different browser on the same phone downloads the app again; nothing is shared.
12. **The API loads schemas at boot.** Edit a schema and the running container keeps the old one until it restarts — and an old API will reject a new step id as an unknown field. Restart after changing a form.

---

## Roadmap

| Next | Why |
|---|---|
| Co-designer run: NVDA, TalkBack, keyboard, 200 % zoom, sound off | it is the gate |
| Level 1: `<script src="…/embed.js" data-form="savanna-onboard-v1">` | one line into Savanna |
| Retention + deletion request path | required before real learner data |
| `job → schema.org/JobPosting`, `onboard → Open Badges 3.0` | Level 3 |
| Arabic and Oromo strings | the schema is already language-keyed |

---

## Credits

- **Theme, palette and Poppins** from [`alx-africa/Savanna-static-pages`](https://github.com/alx-africa/Savanna-static-pages). Their colours are used as-is wherever they pass, and adjusted by the minimum amount where they do not — every decision is commented in `app/src/styles.css`.
- **Noto Sans Ethiopic** and **Poppins** are OFL-licensed and self-hosted, so no request ever leaves the page.
- **The GOV.UK Design System** error-summary pattern — the most widely tested error pattern on the web, and we did not invent a replacement.
- **Amharic content** reviewed by a native speaker on the team.
- Built by four engineers and a co-designer in two days.

## Licence

MIT — see [`LICENSE`](./LICENSE).
