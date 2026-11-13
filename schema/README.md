# Schemas — the contract

> **The schema describes the form and its accessibility requirements. The renderer implements them.**
> A schema cannot make a form accessible; it can only say what is required so the renderer has no
> excuse. Every rule below exists because something in the renderer depends on it.

Three forms, one renderer. **11 input types + statement + review + submit.** Everything else is content.

```bash
node schema/validate.mjs schema/*.json     # exit 0 = the schema is legal
```

| File | Questions | Used by |
|---|---|---|
| `savanna-onboard-v1.json` | 7 (+1 conditional) | the gate task — the demo's main path |
| `savanna-job-v1.json` | 7 | job application |
| `employer-accommodations-v1.json` | 5 | employer form → generates `schema.org/JobPosting` |

## Privacy vocabulary — three states, not two

| Field | Meaning | Enforced by |
|---|---|---|
| `localOnly: true` | The answer **never leaves the device**. Used for how a person wants the form displayed. | client strips it; the API refuses it (`stripped`); a test greps the data file |
| `sharing: {…}` | The answer **is** sent, and this step moves personal data to a named recipient. | `E23` requires `pii: personal\|sensitive`, `localOnly: false`, and names the recipient and fields |
| neither | ordinary answer, sent, no third party | — |

`assistance` (does this person want a phone call?) is shared, with an explicit yes/no and a
disclosure of exactly what moves: **name and phone number, nothing about health or disability.**
`accessibility-prefs` (read aloud, bigger text, simple words) is `localOnly` — how the form looks
is nobody's business but the reader's.

A step that only *gates* sharing (the referral consent) is `pii: "personal"` with
`sharing.consentRequired`, because it moves data even though it holds none. `E22` also forbids
`voice: true` on consent screens: **a transcript must never look like consent.**

---

## 1. Step types the renderer must implement

| `type` | Renders as | Accessibility requirement (implement once, here) |
|---|---|---|
| `text` | `<input type="text">` (+ `inputmode`) | `<label for>`; hint and error both via `aria-describedby`, hint first |
| `tel` | `<input type="tel" inputmode="tel">` | same as text; never split into boxes |
| `textarea` | `<textarea rows="4">` | same as text; never fixed height (1.4.12) |
| `radio` | `<fieldset><legend>` + `<input type="radio">` | legend is the question; each radio has its own `<label>`; arrow keys work natively |
| `checkbox` | `<fieldset><legend>` + `<input type="checkbox">` | legend is the question; never `aria-expanded` on a checkbox |
| `date-ec-gc` | 3 selects (EC by default, toggle to GC) | each select labelled "day / month / year"; year-only is a valid state |
| `statement` | `<h2>` + body text + one consent checkbox | body is read in reading order; checkbox is native |
| `review` | `<dl>` of every answered question + Change links | `<a>`/`<button>` per row with a visually-hidden "Change *name*" |
| `submit` | consent checkbox + submit button | submit is `<button type="submit">`, never disabled |

**The one rule that covers most of the gate:** every question's `<h1>` contains the question text, and the label/legend repeats it or a shortened form. Focus moves to that `<h1>` (`tabindex="-1"`) on every step change, and the new step is announced politely.

## 2. Field-by-field meaning

| Key | Meaning |
|---|---|
| `label` / `legend` | The question. Localized `{am,en}`. Required. |
| `simple` | The same question in plain words, used by SimpleMode. Optional — falls back to `label`. |
| `hint` | One short sentence, under the question, wired by `aria-describedby`. |
| `why` | ContextReminder — *"we ask because…"*. Rendered **above** the label, in smaller text. |
| `icon` | A key (`person`, `phone`, `id`, `help`, `check`, `work`, `clock`, `door`, `hands`, `speaker`, `building`, `home`, `doc`, `card`, `book`, `people`, `text-large`, `simple`, `desk`, `none`). Missing icon = no image, never a broken one. |
| `voice` | `true` on every question — the brief requires it. `VoiceField` wraps all of them. |
| `readAloud` | `true` on every question — the brief requires it. |
| `required` / `optional` | Never an asterisk. Optional fields say "Optional" in words. |
| `pii` | `none` \| `personal` \| `sensitive`. Drives logging only. |
| `localOnly` | **`true` means: never leaves the browser.** Excluded from the submitted payload and from the resume code. This is how "a private way to ask for support" is guaranteed structurally instead of by promise. |
| `showIf` | `{step, in:[…]}` — only renders when an earlier step's answer is in the list. Backwards only, enforced by the validator. |
| `validation` | Array of `{rule, value?}`. Vocabulary: `required`, `phone-et`, `minLength`, `maxLength`, `exclusiveOption`. |
| `options[].applies` | On the support question: choosing it sets a setting — `readAloud` \| `largeText` \| `simpleMode` \| `humanHelp`. **This is the accessibility profile: the user asks for support once, in the form, and the form changes.** |
| `options[].exclusive` | "I prefer not to say" clears and disables the other boxes. |

## 3. Three behaviours the schema demands

1. **Localized at render, not at authoring.** `t(label)` returns `label[lang]`. If a key is missing in `am`, show the `en` text and log it — never render an empty label.
2. **Local-only fields are filtered at submit.** Walk the answers, drop every `localOnly: true` step, then submit. Write one test for this. It is the privacy claim on your slide.
3. **`showIf` re-evaluates on every change**, and if the user's answer makes the current step invisible (they went Back and changed the route), forward them to the next visible step — do not strand them on a hidden question.

## 4. Amharic status — read this before you ship

Every Amharic string here is a **first draft written by an AI, not a native speaker**. It is deliberately plain and short so a reviewer can fix it quickly, but:

- **Have a native speaker read all 100 strings aloud** — the co-designer or an Amharic-speaking teammate. Budget 30–40 minutes. This is the highest-value 40 minutes in the whole build.
- Keep the English final: it is the reference for meaning.
- When they approve, change `"contentStatus": "am-draft-unreviewed"` to `"reviewed"`. The validator warns until you do.
- SimpleMode labels (`simple`) are single words on purpose — review those hardest, because they are what a low-literacy user reads.

## 5. Adding a fourth form

Copy a file, change `id`, `kind`, `title`, `steps`. Run the validator. Nothing in the renderer changes — that is the whole claim of the "same engine" slide, and it should take under 20 minutes to prove on stage.

## 6. What is deliberately absent

No `email`, `number`, `select`, `file`, password, or symbol fields — no form in this build asks for one, and every extra type is another component to make accessible. If a form later needs a file, add `type: "file"` and implement it once, with a spoken "hold steady" hint and no auto-rejection.
