# Review of the schema audit

**Scope:** an external AI review of `schema/savanna-onboard-v1.json` (513 lines), 13 sections, a 3-stage plan.
**Reviewed:** 13 Nov 2026, against the schema *and* the renderer, validator and API in this repo.

**Status: implemented 13 Nov.** Phases 0–6 of `docs/fix-plan.md` are done — see §6.
**Verdict in one line:** roughly 60 % of it is right and worth doing, ~25 % is describing something we already built (the reviewer only saw the schema), and ~15 % is architecture tourism that would cost more than it returns before Sunday 16:30.

Every "already true" below cites the file and line, so it can be checked rather than believed.

---

## 1. Where we disagree

### 1.1 "Some use `legend`, others `label`" — not an inconsistency, a requirement

`legend` is used on `language`, `support`, `id-route` (and `availability`, `job-support`, `accommodations` in the other two forms). That is **by design**: a group of radio buttons or checkboxes is a `<fieldset>` and needs a `<legend>`; a single input needs a `<label>`. `validate.mjs:78` enforces exactly this —

```js
const labelKey = CHOICE_TYPES.has(st.type) ? 'legend' : 'label';
```

Collapsing both into `content.label` would make the schema *less* expressive and force the renderer to re-derive group-ness from the type. **Reject.**

### 1.2 "Some use `required` and `optional` simultaneously" — factually wrong

No step in any of the three forms sets both. `optional` is a *display* flag (it renders the word "አስፈላጊ አይደለም" next to the label and is read by screen readers); `required` drives validation. They answer different questions.

Still, the redundancy is real and the reviewer's underlying instinct is right: `optional` could be derived from `required: false`. **Agree in principle, low priority** — it is a rename touching three schemas, the renderer, the validator and the tests for zero user-visible benefit, in the last 40 hours.

### 1.3 "Standardise on `am-ET` and `en`" — reject

`lang="am"` is the correct HTML/AX value; `am-ET` adds no information for a language spoken in one country and would churn every string key, the language step's option values, `schema.langs`, the validator's `LANGS`, and the `E21` rule. It also breaks the voice recogniser's `am-ET` mapping, which is where a region tag *does* belong.

What is fair: **review status should be per locale.** `contentStatus: "reviewed"` currently speaks for both languages when only Amharic was read by a native speaker. **Adopt the narrow version** — `contentStatus: { am: "reviewed", en: "unreviewed-native-speaker" }`. Cheap, honest, and it is the kind of claim a judge may probe.

### 1.4 `{field}` interpolation in error messages — reject, it breaks Amharic

The proposal:

```json
"required": { "en": "{field} is required.", "am": "{field} ያስፈልጋል።" }
```

This assumes every field name can be dropped into a sentence stem. Amharic is agglutinative and marks case on the noun, so *"ስም"* + *"ያስፈልጋል"* is fine but *"የትውልድ ቦታ"* and *"ስልክ ቁጥር"* need different linking forms. Building a message out of pieces is exactly how localisation goes wrong in languages the builders do not speak.

We already have the field context, structurally:

- the error is announced **with the field** (`aria-describedby`, `aria-invalid`);
- the summary prepends the question: `"ስምዎን ይጻፉ: ይህን መሙላት ያስፈልጋል።"`.

That reads better than `"{field} is required"` for a low-literacy user, and it is grammar-safe in both languages. **Reject.**

### 1.5 The rest of their error-handling checklist — already implemented

Their six required renderer behaviours are all present and tested: identify the field, text not colour alone, associate with the field, move focus on failure, summary with links, announce status. See `screens.tsx` (`ErrorSummary`, `role="alert"`, GOV.UK pattern), `fields.tsx` (`aria-invalid`, `aria-describedby`), `App.tsx` (focus to summary on failed submit), `tests/a11y.spec.mjs` (12 audits). **Nothing to do.** Their Stage 3 is roughly 80 % shipped.

### 1.6 Their persistence block — reject as written

```json
"resume": { "enabled": true, "tokenRequired": true, "tokenExpiryHours": 72, "singleUse": true }
```

Declaring a token-based resume service we do not have is worse than not declaring it: it reads as a capability to an integrating institution and it is a lie to a security reviewer. Config that the backend does not enforce is how the audit itself describes bad privacy metadata — the same criticism applies to this block.

**Adopt the part that is real:** autosave currently happens silently. That is an actual 4.1.3 gap. Cheap fix on our side, no schema change.

### 1.7 JSON Schema `$defs` / `oneOf` — right idea, wrong week

Discriminated field types would be the correct shape for a product with a five-year life. Today we have `validate.mjs` with **21 error codes and 8 warnings** covering type-specific requirements (`E07`), `showIf` reference existence (`E09`), `localOnly` invariants (`E10`), validation/error-code parity (`E14`/`E15`), and review/submit cardinality (`E18`/`E19`). Rewriting that as JSON Schema in the last 40 hours converts a working validator into a half-migrated one.

**Reject now, agree for v2.**

---

## 2. Where the reviewer is right, and it matters

### 2.1 The `support` field conflates three different things — the strongest finding

Verified in the schema: `support` is `pii: "sensitive"`, `localOnly: true`, and offers `human-help` alongside `read-aloud`.

That is a functional contradiction, exactly as described. We claim "someone can help me fill this in", and then guarantee the request reaches nobody. The privacy decision that produced it was correct (no medical proof, nothing leaves the device) — but we solved privacy by making a service request un-actionable.

**Agree.** Split into:

- `accessibility-prefs` — `read-aloud`, `large-text`, `simple-words` (+ maybe `high-contrast`, `reduced-motion`). `localOnly: true`. These *act on the interface*; they need no recipient.
- `assistance` — "I would like a person to help me." `localOnly: false`, `pii: "personal"`, its own consent line, and an explicit statement of what is shared (name + phone with a named partner).

This is the highest-value change in the whole audit, and it is the one the co-designer will feel.

### 2.2 `referral` is `pii: "none"` while triggering the sharing of a name and phone — sharp catch

Verified: `referral` is `pii: "none"`, `localOnly: false`, and it is in the payload. The *field* contains no personal data; the *step* causes personal data to be shared.

**Agree.** Privacy metadata should describe the data flow, not the input widget. Minimum fix, no new machinery: `pii: "personal"` + a `sharing` note naming the recipient and the fields, and the consent body must state who receives it, what is shared, and how to withdraw.

### 2.3 No "I don't have any document" route — right, and it is a dignity issue

Our five options are Fayda / refugee / passport / other / *refer*. "Refer me to a partner" is doing double duty for two different situations: *"I don't have a document"* and *"I want a human to help me choose"*. Someone with no document at all has to infer that "refer" means them.

**Agree.** Split into `no-document` ("I don't have any of these") and `help-choosing` ("I need help choosing"). Note this is a *content* change — new Amharic strings, which need the native speaker's approval before they ship.

### 2.4 Speech configuration is over-specified but under-described — agree, and it found a defect

`voice: true` / `readAloud: true` genuinely do not say what the renderer must do. The reviewer's `activation` / `requireConfirmation` framing is right, and their line —

> *For consent, the person must explicitly perform the required action. A speech transcription must never count as consent automatically.*

— is correct, and **we violate it.** Verified in `fields.tsx`: the `referral` step (a consent statement) carries `voice: true`, and the voice handler for non-choice steps does `onChange(text.trim())` — dictation fills a consent step with a transcript. It cannot grant consent (the value fails validation), but the user sees an error for a field they did not touch. Two other consequences, same root:

- `readAloud` is `true` on `referral` but the renderer excludes `statement` steps from read-aloud (`App.tsx`, `showReadAloud`) — so **the consent body cannot be read aloud**, on the one screen where a low-literacy user most needs it.
- `validate.mjs` `E12` *forces* `voice: true` on every input type, including statements, so the schema cannot express the correct rule.

**Fix agreed and cheap** (code + validator, no new content): drop voice from `statement`/`submit` types, require `readAloud` there instead, and render read-aloud on statement steps.

### 2.5 Hidden conditional answers must not be submitted — already true, but by luck, not by rule

The rule is right and it is the kind of bug that leaks data quietly. It is already satisfied: `useForm.ts:35` computes `visibleSteps(schema, values)` and `submit()` iterates only those, so an `id-value` typed before switching to `refer` is never in the payload.

Worth protecting, though: nothing currently *tests* it. **Add a regression test** — type an ID number, switch to "refer me", submit, assert the payload has no `id-value`.

### 2.6 Missing schema checks — two real gaps in `validate.mjs`

The reviewer's list is mostly already covered (§1.7). Two are not:

- `showIf.in` values are not checked against the referenced step's **option values** (`E09` only checks the step exists). A typo like `["referal"]` silently hides a step forever.
- No duplicate-`showIf`-target sanity check (a step that depends on a later step).

**Agree, ~15 lines.**

---

## 3. Where the audit is factually wrong about our code

| Audit claim | Reality |
|---|---|
| "Progress should be calculated from the actual visible steps, not the total number of entries" | Already dynamic: `visibleSteps()` drives progress **and** an announcement when a conditional answer adds a question (*"ደረጃ 5 ከ 8 — አዲስ ጥያቄ ተጨምሯል።"*). Tested in `tests/voice.mjs`. |
| "Use actual `fieldset`, `legend`, `input type=radio` rather than clickable divs" | We already do — and the group's accessible name comes from the `<h1>` via `aria-labelledby`, deliberately, to avoid a double announcement. |
| "Add schema validation: duplicate ids, locale completeness, `showIf` references, error-code parity" | `validate.mjs` has all of these (E01, E04, E09, E14, E15) and runs in CI. |
| "Client-side validation does not replace server-side validation" | Agreed, implemented: the API re-validates every answer against the same schema and returns the same rule names (`api/server.mjs`, 33 assertions). |
| "Add voice with confirmation" | Implemented: transcript is shown, "We heard / We will use", explicit accept, never auto-written. |

This is not a criticism of the reviewer — they saw 513 lines of JSON and one pasted file. But it is the reason a review like this must be checked against the code before it is acted on.

---

## 4. One thing we should adopt that the audit only implies

Its closing line is the best sentence in the document:

> *Don't make your schema responsible for implementing accessibility. Make it responsible for describing the form and its accessibility requirements.*

That belongs in `schema/README.md` as the first paragraph, because it is the argument for the whole architecture.

And one risk the audit **missed**, which is bigger than most of what it raised:

**`id-value` is stored in plaintext.** `api/data/submissions.jsonl` holds names, phone numbers and ID numbers as JSON, chmod 600, no encryption at rest, no access control beyond the filesystem. Our README states plainly that support answers never leave the device — good — but it should state with equal clarity that a national ID number *is* stored, and that production needs at-rest encryption and a deletion path.

---

## 5. What I would actually do in the remaining time

Ranked by (user impact × gate risk) ÷ hours.

| # | Change | Why | Hours |
|---|---|---|---|
| 1 | Split `support` → `accessibility-prefs` (local) + `assistance` (shared, consented) | The contradiction; 30 points of "works for intended users" | 1.5 |
| 2 | Split `id-route`'s `refer` → `no-document` + `help-choosing` | Dignity + completeness of the ID route | 0.5 (+ content review) |
| 3 | Consent step: no voice, yes read-aloud; validator rule fixed | A defect we can see and fix today | 0.5 |
| 4 | `referral` → `pii: "personal"` + explicit sharing consent copy | Privacy claim integrity | 0.5 |
| 5 | Regression test: hidden answers never submitted | Locks in a property that is currently accidental | 0.25 |
| 6 | Autosave announces "saved" | 4.1.3, currently silent | 0.25 |
| 7 | `validate.mjs`: `showIf.in` vs real option values | Cheap, stops silent breakage | 0.25 |
| 8 | Per-locale `contentStatus` | Honest about which strings were reviewed | 0.25 |

**Done: 1, 2, 3, 4, 5, 6, 7 — plus encryption at rest, which the audit missed. Item 8 dropped on
your instruction (do not re-flag `contentStatus`).**

**Total ≈ 4 hours.** Everything else in the audit — the `content`/`input`/`data` regrouping, the condition language, JSON Schema `$defs`, the partner directory service, the persistence token block — is correct for v2 and wrong for this weekend. Doing it now would leave a half-migrated schema at 16:00 Sunday, which is the one outcome nobody forgives.

**Asked, not decided:** items 1, 2 and 4 introduce or change **Amharic strings**. Those are the native speaker's call, not mine.
