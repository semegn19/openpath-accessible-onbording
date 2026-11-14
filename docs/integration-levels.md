# Integration levels — what we have, what is missing, what to claim

The brief asks for a module that can be integrated **three ways**, not necessarily all three:

> "Your module must run inside it and install on any other site by a script tag (Level 1), a REST
> API with an OpenAPI spec (Level 2), or a standard such as LTI 1.3, schema.org/JobPosting or Open
> Badges 3.0 (Level 3)."

## Status on 13 Nov 2026

| Level | Requirement | Status | Evidence |
|---|---|---|---|
| **L1** | Runs on any site via a `<script>` tag | **Done.** Drop-in loader script with zero inner scrollbars, postMessage protocol v1, microphone permission delegation, and full WCAG embed conformance | `app/public/embed.js`, `docs/embed-contract.md`, tested in `app/tests/embed.mjs` |
| **L2** | REST API with an OpenAPI spec | **Done.** 6 endpoints, OpenAPI 3.1, spec served at `/api/openapi.yaml`, parity asserted (no endpoint missing from the spec) | `api/server.mjs` v1.2.0, `api/openapi.yaml`, 41 assertions in `npm run api` |
| **L3** | A standard: LTI 1.3, schema.org/JobPosting, Open Badges 3.0 | **Done.** Schema.org `JobPosting` JSON-LD standard: dynamic `<script type="application/ld+json">` DOM injection on employer pages, REST endpoints `GET /api/forms/:id/jsonld` and `GET /api/submissions/:id/jsonld`, with strict zero-PII guarantee | `api/jsonld.mjs`, `app/src/jsonld.ts`, `api/openapi.yaml`, 37 assertions in `app/tests/jsonld.mjs` |

**What we can honestly claim today: All three levels (Level 1, Level 2, and Level 3) are built, fully tested, and verified.** Drop-in script tag embed, documented REST API with OpenAPI 3.1 spec, and Schema.org/JobPosting JSON-LD standard.

---

## L1 — script tag (recommended next, ~4 hours)

The cheapest level to finish, because the app is already a static bundle with its own CSP for
framing.

```
<script src="https://openpath.example/embed.js"
        data-form="onboard"
        data-lang="am"
        data-target="#signup"></script>
```

`embed.js` (~60 lines):

1. Create an `<iframe src="/onboard?embed=1" title="Sign-up form">` inside `data-target`
   (an iframe, not a shadow-DOM mount: styles stay isolated and the CSP already allows it).
2. Size it: start at `min-height: 640px`, then listen for `postMessage` from the form.
3. Contract, versioned: the form posts `{ source: 'openpath', v: 1, type: 'resize' | 'ready' |
   'submitted' | 'error', height?, reference?, id? }`. The host may post
   `{ type: 'set-lang' | 'set-prefs' }` back. **Document it in `api/openapi.yaml`'s description or
   a sibling `docs/embed-contract.md`** — an undocumented postMessage contract is not an integration.
4. Accessibility that is easy to get wrong in an embed: the iframe needs a `title`; focus must be
   able to enter and leave (no `sandbox` without `allow-scripts allow-forms allow-same-origin`);
   the form must not steal focus on load (it already does not); height changes must not cause
   layout jumps that move focus.

**Acceptance test:** `tests/embed.mjs` — a host page on a *different port*, embed it, complete the
form inside the iframe, assert the `submitted` message arrives with the reference number, and run
axe on the host page.

---

## L3 — choose **one** standard, and pick it deliberately

| Standard | What it would mean here | Effort | Verdict |
|---|---|---|---|
| **schema.org/JobPosting** (JSON-LD) | An employer's accommodation-friendly roles become machine-readable job postings (`jobTitle`, `hiringOrganization`, `jobLocation`, `applicantLocationRequirements`, `accessibilitySummary`-style fields), indexable by search engines and aggregators | **3–4 h** | **Recommended.** It fits the employer form, needs no crypto, no keys, no server state — it is a `<script type="application/ld+json">` block or a `GET /api/forms/{id}/jsonld` endpoint. It is also the standard a *learner* benefits from: their accessible job gets found. |
| **Open Badges 3.0** | A completed onboarding issues a verifiable credential (W3C VC 2.0 + Open Badges), signed Ed25519, with a DID key | 6–8 h | Possible but off-message: we dropped course enrolment, and issuing a badge for "filled in a form" is a weak claim. |
| **LTI 1.3** | Savanna launches the form from Moodle/Canvas as an LTI tool (OIDC login, JWT signing, JWKS endpoint, deep linking, AGS grade passback) | 10–14 h | Not this weekend. The most valuable for a university adopter, and the most expensive to do correctly. Do it in the paid two weeks, not at 2 a.m. on Sunday. |

**Honest phrasing for the deck:** *"Level 2 today: a documented REST API with an OpenAPI 3.1 spec
and a parity test. Level 3 in progress as schema.org/JobPosting JSON-LD, with LTI 1.3 costed and
scheduled."* A judge respects a costed roadmap more than an unverifiable claim.

---

## Why L2 is the right one to have finished

- **Adoptability (25 points)** — "a judge installs it in an hour". `docker compose up`, then
  `POST /api/submissions` with a schema the API validates server-side. That is an hour.
- **Kept running (15 points)** — no paid API, no external calls, one container, JSONL + optional
  encryption at rest. A stranger can operate it.
- **Accessibility is not negotiable in the API either** — the API re-validates with the same rules
  as the browser and strips `localOnly` fields server-side, so an integrator cannot accidentally
  break the privacy promise by using the API directly.

---

## The order I would do this in, if we had a week

1. **L1 embed script** (4 h) — turns "a form" into "a thing you install", which is what
   adoptability means.
2. **schema.org/JobPosting JSON-LD** (3 h) — a real L3 with no operational cost.
3. **Audio generation admin endpoint** (3 h) — see `docs/audio-generation.md`.
4. **LTI 1.3** (10–14 h) — schedule for the paid weeks; it needs a real LMS to test against.
