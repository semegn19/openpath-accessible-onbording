# Fix plan — schema audit follow-up

> **Status: all 7 phases implemented on 13 Nov 2026.** `npm run validate` 0 errors · 17 axe audits
> 0 serious/critical · 9 suites green · `git log` shows baseline → implementation.
> Content approved by the native speaker; partner wording is generic because AAAPD is **not** a
> confirmed partner (the hackathon page only says "a partner such as AAAPD").

**Source:** `docs/schema-audit-review.md` (agreed items) + three defects found while checking it + one risk the audit missed.
**Owner:** whoever runs `npm run check` next.
**Rule for the whole plan:** `npm run check` must be green at the end of every phase. A red check at 15:00 Sunday is the only unrecoverable failure mode.

**Total: ~5 h 45 m** of work, 7 phases. Phases 2, 3 and 4 need **Amharic strings approved by the native speaker first** — they are listed in §7.

---

## Phase 0 — Baseline (10 min, no user-visible change)

There is **no git repository in this workspace**. Before touching a schema that three live forms and nine test suites depend on:

```bash
git init && git add -A && git commit -m "green baseline: 9 suites, 0 serious/critical"
```

Then extract the duplicated flow-walking code. Six test files (`a11y.spec.mjs`, `announce.mjs`, `submit.mjs`, `voice.mjs`, `shots.mjs`, `shot-success.mjs`) each re-implement the same ~15 clicks. Adding one step to the form breaks all six at once, and they will drift.

```js
// tests/_flow.mjs  — one walk, six consumers
export async function answer(page, { lang = 'am', prefs = [], assistance = null,
  name = 'ሳራ በቀለ ታደሰ', phone = '0912345678', route = 'fayda', idValue = '3910028475', consent = true } = {})
```

`answer()` walks to the submit step; each caller decides what to assert. **Net: −120 lines, and phase 2 and 3 become a one-line change per test instead of six.**

**Gate:** `npm run check` green, unchanged output.

---

## Phase 1 — Consent must not be dictated, and must be readable (45 min)

The defect: `referral` is a consent statement with `voice: true`; dictation writes a transcript into the field (`fields.tsx`, non-choice branch → `onChange(text.trim())`). It cannot grant consent (the value fails validation) but the user gets an error on a field they never touched. And `readAloud: true` on that step does nothing, because `App.tsx:207` excludes `statement` from read-aloud — so **the consent body cannot be heard**, on the screen where a low-literacy user most needs it.

| File | Change |
|---|---|
| `schema/savanna-onboard-v1.json` | `referral`: `"voice": false`, keep `"readAloud": true`. Same in `savanna-job-v1.json` / `employer-accommodations-v1.json` if their submit steps carry voice (they do not, but check). |
| `app/src/fields.tsx` | guard the voice handler: return `null` for `statement` and `submit` — defence in depth, so a future schema cannot reintroduce this |
| `app/src/App.tsx` | `showReadAloud` now includes `statement`; reads question + hint + `body` |
| `schema/validate.mjs` | `E12` (voice required) applies to **input types only**; new `E22`: `statement`/`submit` must have `readAloud: true` and must not have `voice: true` |
| `app/tests/_flow.mjs` | assert no mic button is rendered on the consent screen |

**Gate:** new assertion "no voice control on consent"; `npm run a11y` still 12/12.

---

## Phase 2 — Split `support` into preferences and assistance (1 h 30 m, **needs content approval**)

The contradiction: `human-help` ("Talk to a person") lives in a field marked `localOnly: true`. The product promises help and guarantees the request reaches nobody.

### 2a. New step `accessibility-prefs` (replaces `support`; **same option values**, so the settings wiring barely moves)

```json
{
  "id": "accessibility-prefs",
  "type": "checkbox",
  "legend": { "am": "ቅጹ እንዴት እንዲሠራልዎት ይመርጣሉ?", "en": "How would you like this form to work for you?" },
  "simple": { "am": "እርዳታ", "en": "Help" },
  "hint":   { "am": "የሚመርጡት ነገር ቅጹን ወዲያውኑ ይለውጣል። በኋላም መቀየር ይችላሉ።",
              "en": "What you choose changes this form straight away. You can change it later." },
  "options": ["read-aloud", "large-text", "simple-words"],
  "required": false, "localOnly": true, "pii": "sensitive", "voice": true, "readAloud": true
}
```

`human-help` and `prefer-not` **leave this step.** `prefer-not` was only meaningful when the question was personal; on a display-preference question, selecting nothing *is* the refusal.

### 2b. New step `assistance` — the one that can actually reach someone

```json
{
  "id": "assistance",
  "type": "radio",
  "legend": { "am": "አንድ ሰው እንዲያግዝዎ ይፈልጋሉ?", "en": "Would you like a person to help you?" },
  "simple": { "am": "እርዳታ በስልክ", "en": "Help by phone" },
  "hint":   { "am": "ስምዎንና ስልክ ቁጥርዎን ብቻ ለአጋራችን እንሰጣለን። ሌላ መረጃ አንሰጥም።",
              "en": "We give only your name and phone number to our partner. Nothing else." },
  "options": [
    { "value": "call-me",     "label": { "am": "አዎ፣ ይደውሉልኝ", "en": "Yes, call me" } },
    { "value": "no-thanks",   "label": { "am": "አይ፣ ራሴ እሞላለሁ", "en": "No, I will fill it myself" } }
  ],
  "required": true,
  "localOnly": false,
  "pii": "personal",
  "sharing": { "recipient": "AAAPD", "fields": ["name", "phone"], "purpose": "registration-assistance" },
  "voice": true, "readAloud": true, "icon": "hands"
}
```

Why `required`: an unanswered "do you want a call?" is a request nobody can act on. Two explicit options mean nobody has to infer that silence means no.

### 2c. Code

| File | Change |
|---|---|
| `app/src/App.tsx` | `applySupport` triggers on `accessibility-prefs` (values unchanged). The announcement code is unchanged. |
| `schema/validate.mjs` | new `E23`: a step with `sharing` must be `localOnly: false`, `pii: "personal"\|"sensitive"`, and must appear before the review step |
| `api/server.mjs` | `NEVER_STORED` gains `accessibility-prefs` (belt and braces; `localOnly` already strips it) |
| `app/tests/_flow.mjs` | one extra click; `assistance` default `no-thanks` |

### 2d. What this changes for the user

The support question no longer implies a service. The person who wants a human gets a real, consented request that reaches the institution. **This is the change the co-designer will feel most.**

**Gate:** payload contains `assistance` but **no** `accessibility-prefs`; `npm run a11y` 12/12; `npm run api` still passes (new step id accepted, unknown-field still enforced).

---

## Phase 3 — Identity routes: add the two that are missing (45 min, **needs content approval**)

`refer` currently does double duty for *"I have no document"* and *"help me choose"*. Someone with no document has to guess that "refer me to a partner" means them.

```json
"options": [
  { "value": "fayda",        "label": { "am": "የፋይዳ ቁጥር", "en": "Fayda number" } },
  { "value": "refugee",      "label": { "am": "የስደተኛ መታወቂያ", "en": "Refugee ID" } },
  { "value": "passport",     "label": { "am": "ፓስፖርት", "en": "Passport" } },
  { "value": "other",        "label": { "am": "ሌላ ሰነድ", "en": "Another document" } },
  { "value": "no-document",  "label": { "am": "ምንም መታወቂያ የለኝም", "en": "I do not have any of these" } },
  { "value": "help-choosing","label": { "am": "የትኛውን እንድመርጥ እርዳታ እፈልጋለሁ", "en": "I need help choosing" } }
]
```

- `referral.showIf.in` → `["no-document", "help-choosing"]`; `refer` value retired.
- `referral` body rewritten to answer *who / what / what next / how to withdraw* (§7).
- **`referral` `pii: "none"` → `"personal"`** with `sharing: {recipient: "AAAPD", fields: ["name","phone"], consentRequired: true}`. The field holds no personal data; the step *causes* personal data to move. Privacy metadata must describe the flow, not the widget.

**Migration check:** the API accepts `id-route` values from the schema, so a client still sending `refer` now gets `422 not-an-option`. That is correct and loud. Old stored records keep `refer` — nothing to migrate, since we never re-validate stored data.

**Gate:** `npm run validate` green; a test asserts `refer` is now rejected and `no-document` is accepted.

---

## Phase 4 — Data at rest (1 h)

The risk the audit missed: `id-value` (a national ID number) and names and phones sit in `api/data/submissions.jsonl` as plaintext JSON, chmod 600 and nothing more. Our README is loud about support answers never leaving the device; it must be equally clear that an ID number **is** stored.

**Not documentation — mitigation**, ~40 lines, no dependency:

- `DATA_KEY` env var, 32 bytes base64. When set, values of steps with `pii: "personal" | "sensitive"` are encrypted with **AES-256-GCM** before hitting disk (`{enc:1, iv, tag, ct}`) and decrypted on read.
- No key → boot with a **loud warning**: `DATA_KEY not set — sensitive answers are stored in plaintext. Development only.`
- README gains a **Data at rest** subsection that says exactly what this does and does not protect: it protects a stolen file or a leaked volume. It does **not** protect the unauthenticated `GET /api/submissions/{id}` — the unguessable id is still the only control there.

**Test** (`tests/api.mjs`): with `DATA_KEY` set, POST a submission with a name and an ID number, then grep the file for both literals — they must be absent — and confirm `GET` still returns them in the clear.

**Gate:** new assertions; the existing 33 still pass.

---

## Phase 5 — Two small correctness items (30 min)

| Item | Change |
|---|---|
| **Hidden answers must never be submitted** | Already true (`useForm.ts:35` computes `visibleSteps`, `submit()` iterates only those) but nothing tests it. New test: type an ID number, go back, choose "I do not have any of these", submit → payload has **no** `id-value`. Locks in a property that is currently accidental. |
| **Autosave announces itself** | Drafts save silently. WCAG 4.1.3. Add to the existing polite live region: *"መልሶችዎ ተቀምጠዋል። / Your answers were saved."* — throttled to at most once per 15 s, so it does not become a chatty screen reader. |

---

## Phase 6 — Documentation and schema hygiene (25 min)

| Item | Change |
|---|---|
| `showIf.in` vs real option values | `validate.mjs` `E09` checks the referenced step exists but not that each `in` value is a real option. A typo (`"referal"`) hides a step forever, silently. ~15 lines. |
| Intro no longer counts questions | *"Then answer six questions"* is already wrong — the count depends on the route. §7 for the new string. |
| `schema/README.md` | first paragraph becomes the architectural principle from the audit: **the schema describes the form and its accessibility requirements; the renderer implements them.** Then document `sharing`, `localOnly`, and the two-step support split. |
| `docs/a11y-field-matrix.md` | new rows for `assistance` (it is sent — so the SR/MO/CO columns change what they check) |
| `README.md` | Data at rest, the `assistance` step in the flow diagram, and the ID-route list |
| `docs/schema-audit-review.md` | mark each agreed item as done, with the phase number |

---

## §7 — Amharic strings needing your approval

All new or changed Amharic. **Nothing ships until you read these.** English is mine to draft; Amharic is yours to correct.

| # | Where | Amharic (draft) | English (draft) | Why |
|---|---|---|---|---|
| 1 | `accessibility-prefs` legend | ቅጹ እንዴት እንዲሠራልዎት ይመርጣሉ? | How would you like this form to work for you? | separates *display* from *a person* |
| 2 | `accessibility-prefs` hint | የሚመርጡት ነገር ቅጹን ወዲያውኑ ይለውጣል። በኋላም መቀየር ይችላሉ። | What you choose changes this form straight away. You can change it later. | adds "changeable later" |
| 3 | `assistance` legend | አንድ ሰው እንዲያግዝዎ ይፈልጋሉ? | Would you like a person to help you? | the real service question |
| 4 | `assistance` simple | እርዳታ በስልክ | Help by phone | low-literacy label |
| 5 | `assistance` hint | ስምዎንና ስልክ ቁጥርዎን ብቻ ለአጋራችን እንሰጣለን። ሌላ መረጃ አንሰጥም። | We give only your name and phone number to our partner. Nothing else. | the disclosure, before the choice |
| 6 | `assistance` option 1 | አዎ፣ ይደውሉልኝ | Yes, call me | |
| 7 | `assistance` option 2 | አይ፣ ራሴ እሞላለሁ | No, I will fill it myself | explicit refusal, not silence |
| 8 | `id-route` no-document | ምንም መታወቂያ የለኝም | I do not have any of these | the missing route |
| 9 | `id-route` help-choosing | የትኛውን እንድመርጥ እርዳታ እፈልጋለሁ | I need help choosing | |
| 10 | `referral` body | አጋራችን AAAPD ይደውልልዎታል። ስምዎንና ስልክ ቁጥርዎን ብቻ እናጋራለን። በስልክ ላይ "አልፈልግም" ብለው መሰረዝ ይችላሉ። | Our partner AAAPD will call you. We share only your name and phone number. You can cancel by saying "no" on the call. | adds *how to withdraw* |
| 11 | intro | አስቀድመው ቋንቋዎንና የሚፈልጉትን እርዳታ ይምረጣሉ። ከዚያ ጥቂት ጥያቄዎችን ይመልሳሉ። ጊዜ ገደብ የለም። | First choose your language and any help you need. Then answer a few questions. There is no time limit. | "six" is already wrong |
| 12 | autosave announcement | መልሶችዎ ተቀምጠዋል። | Your answers were saved. | 4.1.3 |

**Two questions for you, not for me:**

1. **Is `assistance` allowed to be shared at all?** It is the only way "a person will help you" becomes true. If the answer is no, then the option must be removed from the form rather than kept as decoration — a help button that reaches nobody is worse than no help button.
2. **Is AAAPD a confirmed partner** for the demo, and does the copy need to name them? If not confirmed, the referral step should say *"a partner organisation"* without naming one.

---

## §8 — Not doing, and why

| Rejected item | Reason |
|---|---|
| Regrouping fields into `content` / `input` / `data` | Renames 3 schemas, the renderer, the validator and 9 test suites for zero user-visible gain, 40 hours before submission. Correct for v2. |
| JSON Schema `$defs` / `oneOf` | Would leave a half-migrated validator. Ours has 21 error codes and 8 warnings that already cover the same ground. |
| A condition language (`all`/`any`/`equals`) | `showIf {step, in}` covers every condition these three forms need. Build it when a form needs it. |
| Partner directory service | A `recipient` field in the schema does the same job with one line. |
| Resume tokens (`tokenExpiryHours`, `singleUse`) | Config for a service we do not have reads as a capability. Worse than silence. |
| Per-locale `contentStatus` | **Dropped** — you told me not to re-flag `contentStatus`. Noting it so nobody assumes it was overlooked. |
| Document upload for "another document" | The audit itself says to wait for the institution to confirm handling. Agreed. |

---

## §9 — Order, checkpoints, rollback

| Phase | What | Time | Checkpoint (`npm run check` + ) |
|---|---|---|---|
| 0 | git init, `_flow.mjs` | 10 m | identical output to today |
| 1 | consent speech | 45 m | "no mic on consent" passes; 12/12 axe |
| 2 | support split | 1 h 30 | payload has `assistance`, not `accessibility-prefs` |
| 3 | identity routes | 45 m | `refer` rejected, `no-document` accepted |
| 4 | encryption at rest | 1 h | plaintext absent from disk, present from API |
| 5 | hidden answers + autosave | 30 m | new regression test passes |
| 6 | docs + `E09` | 25 m | validate green; README consistent |

**Rollback:** one commit per phase, each green. If phase 2 goes wrong at 15:00, `git reset --hard` to the phase-1 commit and ship that — the consent fix and the test refactor are already worth having on their own.

**If only two phases can be done:** phase 1 (consent) and phase 2 (support split). The first is a defect; the second is the highest-scoring difference in the product.
