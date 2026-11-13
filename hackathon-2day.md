# Track 1 — 2-day build sheet

**Digital Bridge Accessibility Hackathon · 14–15 Nov 2026 · ALX Lideta · track 1 (Accessible onboarding)**
Team of 4 + co-designer + mentor. **Submit Sunday 16:30: code, README, Docker Compose, WCAG 2.2 AA conformance report.**

> This is the only plan that matters this weekend. `openpath-build-plan.md` and `phases/` are for the two-week hardening sprint *if you win* — do not open them before Sunday.

---

## 1. The gate — pass or fail, before any points

A co-designer completes **the main task**, unaided, with:

| Condition | What it forbids |
|---|---|
| NVDA **and** TalkBack | Custom div-buttons, unlabelled inputs, aria-live spam |
| Keyboard only | Anything reachable only by touch or mouse |
| **200 % zoom** | Fixed pixel layouts, horizontal scroll, clipped text |
| **Sound off** | Making read-aloud required to complete anything |

Plus: **axe-core zero critical/serious**, and a **WCAG 2.2 AA conformance report** in the repo.

**Therefore the main task is 6 questions and nothing more.** Define it at 10:00 Saturday, write it on the wall, and never add to it:

> **Main task:** language → what support you need → name → phone → how you'll prove who you are (5 ID routes) → review → done. Seven screens, one question each, no time limit.

If the co-designer can't finish those six silently, nothing else on the rubric can score. **Build that first. Everything else is decoration until 13:45 Saturday.**

---

## 2. Where the points are, in build order

| Criterion | Pts | The one thing that earns it | Hours |
|---|---|---|---|
| Works for intended users | **30** | Your co-designer finishes the 6 questions alone, twice, and you changed things because of what they said | 6 |
| Can be adopted | **25** | A stranger runs `docker compose up` + drops a `<script>` tag in, in under an hour, from your README | 3.5 |
| Quality, security, privacy | 15 | axe clean + 6 smoke tests + no server storage unless the user asks + consent screen | 2 |
| Built for Ethiopia | 15 | Amharic default, Ethiopic script + EC calendar, 3G-throttled, offline reload | 2.5 |
| Can be kept running | 15 | **Zero API keys.** No paid service anywhere. README a stranger follows | 1.5 |

**30 + 25 = 55 points are "does it work and can someone else install it".** The Ethiopia/quality/maintainability 45 are all cheap once the engine exists — they are *config and docs*, not features. Spend your hours in this order: **gate → install → Ethiopia → docs**. Never the reverse.

---

## 3. The one idea that makes 2 days enough

**Wrap by concern, not by field.** Twelve per-field implementations is why this looks like a 3-week project. Instead, three wrappers cover every field and every screen:

```
<Question>            one question per screen, <h1> is the label, hint, error, help slot
  <VoiceField>        mic button + "we heard: …" review card → Accept / Retry / Type
    <Input>           native text | tel | radio | select | date-ec-gc | textarea
<ReadAloud>           speaker button, recorded clip for the 12 fixed questions
<SimpleMode>          swaps labels for plain Amharic + icon, 2× text, everything else identical
```

- **"Voice input on every field"** = `VoiceField` wraps all of them. One component, ~90 lines.
- **"Read-aloud questions"** = 12 recorded clips (a teammate records Amharic on their phone in 20 minutes), cached, works offline, costs nothing, no vendor.
- **"Low-literacy path"** = a `simple` label variant in the content file + an icon per question. Content work, not code.
- **"Everything else"** = the same engine reading a different JSON file.

---

### 3.1 Field inventory — list these first, as you said

Written out, the whole product needs **six input types, not twelve.** That is the single biggest time saving available to you, and it is why the other document's 12-component list is wrong for this weekend.

| # | Field | Type | Forms | Notes |
|---|---|---|---|---|
| 0 | Language | `language` | main (first) | Two big buttons: አማርኛ / English. Sets `document.lang` and every string after it |
| 0b | Support I need | `checkbox` | main (second), job | Choosing it **changes the form immediately**; the answers never leave the phone |
| 1 | Full name | `text` | main, employer (company/role) | One field, hint says *"given name, father's name, grandfather's name"*. Do **not** split into 3 — it triples the gate path for zero demo value |
| 2 | Phone | `tel` | main (prefilled in job) | `+251…` / `09…` / `07…` normalise to E.164. Never split boxes |
| 3 | Identity route | `radio` | main | Fayda · Refugee ID · Passport · Another document · **Refer me to a partner** |
| 4 | Identity value | `text` | main, conditional | Only shows for the first four routes. Optional. Never blocks submission |
| 5 | Support I need | `checkbox` | main, job | Reading · Hearing · Moving · Understanding · **Prefer not to say**. No diagnosis, no proof, never sent to an employer |
| 6 | Long answer | `textarea` | job (experience) | Voice is most valuable here |
| 7 | Consent / declaration | `checkbox` | all three | Single option, required |
| 8 | Choice sets | `radio` / `checkbox` | employer (accommodations), job (availability) | Reuses #3 and #5 unchanged |
| 9 | Date of birth | `date-ec-gc` | profile only — **not** in the gate path | Wire the verified converter; EC shown first, year-only allowed |

**Types you do not need:** email, number, select, file upload, password, symbols. If a form asks for one, it is a `text` field with a different `inputmode`. Delete them from the plan and from the conversation.

**Three forms, one inventory:** main task = fields 1–5 + 7. Job = 1–2 (prefilled) + 5 + 6 + 8 + 7. Employer = 1 + 8 + 7. That is the "same engine, three schemas" story, and it is true because the inventory is small.

### 3.2 Build order — your sequence, with two swaps

You said: fields → basic accessibility → the three wrappers. **Agreed.** Two refinements that save you hours:

**Swap 1 — accessibility is not a phase, it is how you write field #1.** Build *one* field (name) completely — `<label for>`, hint via `aria-describedby`, error, focus ring, 48 px target, `lang="am"` — and fields 2–9 become copies that take minutes each. Field #1 costs 90 minutes; field #8 costs 15. If you build all the fields first and add ARIA later, you rewrite all of them.

**Swap 2 — SimpleMode before ReadAloud before VoiceField.** SimpleMode is content plus a toggle (30 min, zero risk, and it is a *required* brief item). ReadAloud needs clips recorded by a native speaker — that is a **scheduling** dependency, so record at lunch and wire after. VoiceField is the only genuinely risky item (browser API, Amharic accuracy, needs network), so it goes **last and behind a flag**.

| Order | Item | Time | Done when |
|---|---|---|---|
| 1 | The field list above, on the wall | 20 min | Everyone agrees; nobody adds a field |
| 2 | **Field #1 fully accessible** + tokens (contrast, 1.65 line-height, 48 px) | 90 min | NVDA reads label → hint → error in that order |
| 3 | Fields 2–9 by copying field #1's pattern | 2 h | All forms render from JSON |
| 4 | Zoom + keyboard pass across every screen | 45 min | 200 % zoom, no horizontal scroll, no traps |
| 5 | **SimpleMode** (label swap + icon + 2× text) | 45 min | Same form, plainer words, zero data loss |
| 6 | **ReadAloud** — clips recorded at lunch, then the button | 60 min | Works offline from cache, cancels on any keypress |
| 7 | **VoiceField** — one wrapper, feature-flagged | 75 min | "We heard: …" → Accept / Retry / Type. Fails safely |

Contrast, large text and forced-colors are **CSS at step 2**, applied once to all nine fields — not per-field work. A "high contrast mode" switcher is a trap: make the default pass 4.5:1 and let the OS `forced-colors: active` do the rest.

## 4. Scope — what ships, and what you will *not* build

**Ships (7 routes):**
1. `/onboard` — the 6-question main task (the gate)
2. `/support` — private "what support do I need", no diagnosis, no proof
3. `/review` — check your answers, edit anything, submit
4. `/job` — job application (same engine, second schema)
5. `/employer` — the accommodations a job offers (third schema)
6. `/install` — the one-hour install page for judges
7. `/embed-demo` — a page that loads `<openpath-form>` by script tag, for the adoption test

**Kill list — say no now, out loud, in front of the team:**

| Not building | Instead |
|---|---|
| Component library, monorepo, Storybook, package publishing | One app, one `widget.js` bundle |
| Address cascader (region → zone → woreda → kebele) | 3 free-text fields. We *proved* the dataset is stale — say that on the slide; it scores better than a broken picker |
| In-page ASR vendor integration | `webkitSpeechRecognition` with `lang="am-ET"` (free, no key, works in Chrome), fallback = device keyboard mic |
| Cloud TTS | 12 recorded clips + browser `speechSynthesis` fallback |
| Symbol/pictogram grid, EthSL video, reading ruler | Simple words + icons + read-aloud |
| Accounts, passwords, OTP | No login. Resume by 6-character code only |
| File upload of ID documents | "I'll bring it later" + "refer me to a partner" (privacy win, and honest) |
| Design system | The Savanna palette already audited: navy `#002b56`, accent `#5648b7`, focus ring navy (their green fails at 1.5:1 — do not use it) |
| Playwright suite | 6 smoke tests + axe CLI. That's the gate requirement, not more |
| i18n framework | Two JSON files, `lang` attributes set correctly |

**Delete the words "adaptive engine", "preference profile", "homeomorphic" from your vocabulary this weekend.** You have three toggles: bigger text, read aloud, simple words.

---

## 5. Stack — 5 decisions, no debate after this

1. **Vite + React + TypeScript**, single app. No monorepo.
2. **Schema-driven**: one `schema.json` per form; the renderer is ~250 lines. This is what makes "job application on your form engine" a 20-minute job and it *is* the maintainability story.
3. **Native elements only.** `<input>`, `<select>`, `<fieldset>`, `<button>`. No custom ARIA widgets. This is the gate.
4. **`docker compose up`** → nginx (static) + a 150-line Node API (JSON file store, 4 endpoints) + `openapi.yaml`. No database.
5. **Zero third-party paid APIs.** No keys in the repo. Running cost = one container.

**Schema shape — copy this, don't design it:**

```json
{ "id": "savanna-onboard-v1", "locale": ["am", "en"], "calendar": "EC",
  "steps": [
    { "id": "name", "type": "text", "label": { "am": "ስምህ ማን ነው?", "en": "What is your name?" },
      "simple": { "am": "ስም", "en": "Name" }, "icon": "person", "voice": true, "pii": "personal" },
    { "id": "id-route", "type": "radio", "legend": { "am": "ማንነትህን እንዴት እናረጋግጣለን?", "en": "How can we confirm who you are?" },
      "options": [ { "value": "fayda", "label": { "am": "ፋይዳ ቁጥር", "en": "Fayda number" } },
                   { "value": "refugee", "label": { "am": "የስደተኛ መታወቂያ", "en": "Refugee ID" } },
                   { "value": "passport", "label": { "am": "ፓስፖርት", "en": "Passport" } },
                   { "value": "other", "label": { "am": "ሌላ ሰነድ", "en": "Another document" } },
                   { "value": "refer", "label": { "am": "ወደ አጋር ላመርጥ", "en": "Refer me to a partner" } } ] } ] }
```

---

## 6. Saturday — 10:00 to 17:00

**A** engine/renderer · **B** a11y + voice + audio · **C** server/Docker/embed · **D** Amharic content, job forms, README
**Co-designer** is a teammate, not a tester at the end. Seat them next to A and B all day.

| Time | A | B | C | D | Done by end of slot |
|---|---|---|---|---|---|
| 09:45 | Briefing. **Ask the co-designer: what makes you give up on a form?** Write their answer on the wall | | | | One sentence you repeat all weekend |
| 10:00 | Schema + renderer, one question per screen, `<h1>` = label | a11y shell: fieldsets, errors, error summary, focus on step change | Docker Compose + nginx + API skeleton + `/health` | Amharic + English strings for the 6 questions | It renders question 1 in Amharic |
| 11:15 | Validation, error codes, review screen | Native inputs: text, tel, radio, date-ec-gc (verified converter) | `POST/GET /drafts` + 6-char code | Icons (6), simple-mode labels | Empty submit → error summary focused, values kept |
| 12:00 | *Lunch — co-designer eats with you. Ask how they register today.* | | | | |
| 13:00 | **CO-DESIGNER TEST #1 — 30 min, unscheduled, on their own phone.** Do not help. Write down every place they stop | | | | 5 blockers on paper |
| 13:45 | Fix blockers, no new features | Fix blockers | Resume + `sms:` hand-off | Support page copy (am) | The blockers are gone |
| 15:00 | Support page + ID routes + "refer me" | **SimpleMode** (label swap + icon + 2× text) + 3-toggle settings bar | Offline: service worker + localStorage autosave | **Record 12 Amharic clips on a phone, in the room** (do this at lunch if you can) | Simple mode works, clips exist |
| 16:00 | Review screen + edit-one-answer | **ReadAloud** button + clip playback, **cancel on any keypress** | EC calendar wiring + `lang` attributes | Job schema + employer schema (JSON) | Read-aloud works offline |
| 16:30 | — | **`VoiceField` last, behind a flag**, on name then phone only | — | — | Fails safely to typing |
| 16:45 | **Stop. Commit. Demo to your co-designer for 5 minutes: 3 questions unaided.** If they can't, that is tomorrow's first task | | | | Honest status written on the wall |

---

## 7. Sunday — 09:00 to 16:30

| Time | A | B | C | D | Done by end of slot |
|---|---|---|---|---|---|
| 09:00 | Finish the 6-question task end-to-end + review + submit | axe sweep: fix every critical/serious | `docker compose up` from a clean clone on a fresh laptop | README skeleton: install, 3 levels, privacy, limits | Clean clone runs in one command |
| 10:15 | Job + employer forms rendering from JSON | 200 % zoom pass: no h-scroll, nothing clipped | `<openpath-form>` script tag + `widget.js` build + `/embed-demo` | README: the 5-line install | Results from one engine, three forms |
| 11:15 | Resume-by-SMS link + offline reload test (real airplane mode) | Keyboard-only pass on every screen; sound-off pass | `/install` page with copy button + `openapi.yaml` | README: OpenAPI + `schema.org/JobPosting` JSON-LD | Level 1, 2 and 3 all demonstrated |
| 12:00 | *Lunch — rehearse the 3-minute video script with the co-designer* | | | | |
| 13:00 | **CO-DESIGNER TEST #2 — THE GATE REHEARSAL.** Unaided, NVDA/TalkBack, keyboard only, 200 % zoom, **sound off**. Time it. Record it | | | | Either it passes or you have 90 minutes |
| 13:45 | Fix only what they hit. Nothing else | Fix only what they hit | Conformance report: every 2.2 AA criterion, pass / supported / not applicable | Video: 3 min, captions burned in, co-designer speaking | No open gate failures |
| 14:45 | **INDEPENDENT INSTALL TEST:** someone not on your team (mentor, another team) installs from the README. **Time them. Screenshot the clock** | | | | "Installed in N minutes" in the README |
| 15:30 | Conformance report final; axe output pasted in | Amharic review with the co-designer | 3G throttle check + bundle size number in the README | README final; delete the repo's dead code | Submission checklist green |
| 16:15 | **Submit:** code, README, `docker-compose.yml`, conformance report | | | | Submitted before 16:30 |

---

## 8. The 25 points — install in an hour, at all three levels

**Level 1 — script tag.** One file, no build step, no framework:

```html
<div id="signup"></div>
<script src="https://your-host/widget.js" defer></script>
<script>
  OpenPath.mount('#signup', {
    schema: 'https://your-host/api/v1/schemas/savanna-onboard-v1',
    lang: 'am',
    theme: 'savanna'
  });
</script>
```

Ship a `/embed-demo` page that does exactly this **inside a page with Bootstrap loaded**, so a judge can see it does not fight the host's CSS. Put the screenshot in the README.

**Level 2 — REST API with OpenAPI.** Four endpoints and one `openapi.yaml`: `GET /schemas/:id`, `POST /drafts`, `GET /drafts/:code`, `GET /health`. That is a valid, honest Level 2 — do not inflate it.

**Level 3 — a standard.** `schema.org/JobPosting` JSON-LD on `/job`, so the posting is machine-readable. Say plainly: "LTI 1.3 and Open Badges 3.0 are out of scope for track 1" — a named, reasoned gap reads as competence; a fake implementation reads as the opposite.

**The one-hour test in the README:**
> `git clone … && docker compose up` → open `http://localhost:8080/onboard` (or `/job`, `/employer`) → paste the two script lines into any page. **Measured: N minutes, by [name], at 14:45 on 15 Nov, who had never seen the repo.**

---

## 9. The 15+15 — Ethiopia and privacy, in a paragraph each

**Built for Ethiopia:** Amharic is the **default** language, not a toggle. Ethiopic script with `lang="am"` and a Noto Sans Ethiopic fallback, `line-height: 1.65`. EC calendar first via the converter we already verified against 2,399 dates (say that — "we did not hand-roll Ethiopian dates" is a credibility line). Tested on a cheap Android on throttled 3G; airplane-mode reload keeps every answer.

**Quality, security, privacy:** axe zero critical/serious, pasted output. Six smoke tests. **Nothing is stored on a server unless the user taps "save and resume"** — and then a 6-character code, a 7-day expiry, and a delete-on-submit. No diagnosis is ever asked for; "what support do you need" changes the form and is not sent anywhere by default. Consent screen before anything is submitted. No analytics. No third-party scripts.

**Maintainability in one sentence for the slide:** *"One container, no database, no API keys, no per-message cost. A new form is a JSON file."*

---

## 10. Use the 21 October findings — they are worth points under "works for intended users"

The event page lists what 40 disabled and displaced people hit. Map each to your answer in the README and on one slide:

| 21 Oct finding | What you shipped |
|---|---|
| Forms time out | No timer anywhere; autosave + resume code |
| Help is English only | Support request and help text in Amharic, reached from every screen |
| Job boards break under a screen reader | Native semantics, axe zero, co-designer-tested job application |
| Videos lack captions / sign language | Out of scope for track 1 — say so, and say which track owns it |

That table is 3 of the 30 points spent on a slide. Write it Saturday night, not Sunday.

---

## 11. Things that will go wrong — decide now

| Risk | Pre-decided answer |
|---|---|
| `webkitSpeechRecognition` won't do Amharic on demo day | Button stays, shows *"Voice needs Chrome or your keyboard's mic"*, and typing always works. Never a dead end |
| Co-designer finds a fatal blocker at 13:00 Sunday | Fix only that. Cut the job flow to a read-only demo. The gate is worth 30, the career gateway is required but unweighted separately |
| `docker compose` fails on the judge's laptop | Pre-pull images; put a `docker-compose.static.yml` fallback in the README that serves the built app with nginx only |
| Wi-Fi dies | Offline demo is a feature, not an accident: airplane mode is act 4 |
| Someone wants to add one more feature on Sunday | The answer is the kill list in §4. Read it out loud |
| The video doesn't get made | Record a 90-second screen capture on Saturday evening anyway. Judges review submissions during the week — no video is a silent submission |

---

## 12. What "done" looks like at 16:30 Sunday

- [ ] Co-designer completed the 6-question main task **unaided**, twice, with sound off and 200 % zoom — on video
- [ ] axe-core: zero critical, zero serious (output committed)
- [ ] WCAG 2.2 AA conformance report in the repo — every criterion, honestly marked
- [x] **`docker-compose.yml` + `app/Dockerfile` + `app/nginx.conf` written** — static nginx only, no API yet; `/healthz` for the healthcheck; CSP without `unsafe-inline` verified against the shipped bundle
- [x] **`npm run verify:prod`** — the built bundle behind nginx semantics: 3 pages, 12 axe audits, zero CSP violations
- [x] **API + `openapi.yaml`** — 4 endpoints, zero dependencies, OpenAPI 3.1 (validator-clean), spec/code parity asserted in tests, server-side re-validation, rate limit, 32 KB cap, privacy stripping proven by grepping the data file
- [ ] `docker compose up` works from a clean clone on a machine that is not this one (no Docker in the build sandbox — **unverified**)
- [ ] install measured in minutes by someone outside the team
- [ ] Three levels demonstrated: script tag, OpenAPI, JSON-LD
- [ ] Amharic default, EC dates, offline reload, 3G bundle number in the README
- [ ] README a stranger follows, with a 3-minute captioned video and the 21 Oct table
- [ ] No API keys, no paid services, no database, no server storage without consent

Four of those are worth 55 points. The last one is worth 15 and costs you nothing but discipline.

---

## Appendix — the other AI's suggestions, sorted

Their product thinking is good; their architecture is a three-week project. Take the ideas, drop the structure.

| Take it | Why |
|---|---|
| Schema-driven forms | The most important decision, and it makes three forms one engine |
| Never accept a transcript without confirmation; repeat answer; manual edit always available | The brief demands it, and it protects you when Amharic ASR is wrong |
| **ContextReminder** — *"We ask for this because… your date of birth is not shown publicly"* | Best small idea in that document. One hint line per question, ~15 minutes, directly answers "clear labels" |
| EasyRead as **authored** copy, never AI-rewritten | Correct, and it protects you in the Q&A: legal/identity wording is written by a human |
| Accessibility profile saved locally + shareable JSON | Cheap version of their idea: 3 toggles in `localStorage`, plus a download. No sync, no accounts |
| HumanHelpRequest: say *which part* is hard, share only what you consent to | Matches the brief's "private support, no medical proof" |
| Their Savanna findings (div hamburger, `role="button"` with no keyboard, `href="#"`) | One slide: "we audited Savanna's own pages; we don't repeat these". Say *frozen captures, not proof about production* |

| Leave it | Why not this weekend |
|---|---|
| **The monorepo** (`apps/`, `packages/core|ui|react|web-component`, `backend/`) | Package boundaries cost hours and earn **zero** points. "A stranger installs it in an hour" is earned by one flat `src/` and a good README. The rubric does not score your folder tree |
| **Their phase order** — interaction (2) before the engine (3) before the product (3) | Backwards. You cannot test the gate without the 5-question flow. Build the flow, then the interaction |
| 12 field components | You need 6 types (§3.1). Email/number/select/file are not rendered by any of your three forms |
| DocumentCapture + OCR | Explicitly risky even in their own text ("never auto-reject on OCR"). Use "refer me" + "bring it later" |
| Symbol/pictogram grid (AnswerComposer), ReadingRuler, InputMagnifier, KeyboardHelp | All good ideas, all require curation or device tuning |
| "Publish local npm packages" | Level 1 is a script tag. npm earns nothing extra here |
| A separate "pre-hackathon roadmap" with 16 tasks at 0/16 | Do not start a checklist you cannot finish. You have 12 hours |
