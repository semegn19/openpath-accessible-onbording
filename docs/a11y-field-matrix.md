# Field × disability deep-dive matrix

**Purpose:** the gate says *a co-designer completes the main task unaided with NVDA, TalkBack, keyboard only, 200 % zoom and sound off.* This document turns that sentence into per-field checks you can run, tick and show to a judge.

**How to use it.** One row = one thing to verify, on one device, with one person. Tick it only when you have seen it work — a tick without a device and a date is a guess, and the conformance report needs evidence, not confidence.

Add evidence to `docs/a11y-evidence.csv` as you go (`field, group, device, date, tester, result, note`).

---

## 1. The seven groups, and what "pass" means for each

| # | Group | Passes only if… | You test with |
|---|---|---|---|
| **SR** | Blind — screen reader | Every field is announced with label → hint → state → error, in that order, once. Nothing is reachable only visually. | NVDA + Firefox/Chrome, TalkBack + Chrome |
| **LV** | Low vision | At 200 % browser zoom and at 320 CSS px there is no horizontal scrolling, nothing is clipped, and every control keeps a 3:1 boundary. | Browser zoom, Windows High Contrast, `prefers-contrast` |
| **DH** | Deaf / hard of hearing | Nothing requires hearing. Every audio prompt has equivalent on-screen text. The whole task completes with sound off. | Mute the device for the entire run |
| **MO** | Motor / physical | Every control is reachable and operable by Tab/Shift+Tab/Enter/Space/arrows, targets are ≥ 48 px, nothing needs dragging, nothing times out. | Keyboard only; Android Switch Access |
| **CO** | Cognitive / learning | Plain words, one question per screen, errors say what to do next, no memory burden, no time pressure, an "I prefer not to say" out on sensitive questions. | A first-time user who did not build it |
| **LL** | Low literacy | The question is answerable from an icon + a simple label + read-aloud, without reading the long text. | Simple-words mode ON, read-aloud ON |
| **DB** | DeafBlind | Everything works on a braille display: no information carried only by colour, icon, sound or animation. | Braille display or a screen reader with speech off |

---

## 2. Gate-path fields — do these first

### `language` — the first question
*File: `fields.tsx` (group branch) · `App.tsx` (announcement)*

| Group | What must be true | Status |
|---|---|---|
| SR | Two radios, group named by the `<h1>` via `aria-labelledby`; each option says its own language name in its own script | ☐ |
| SR | **Changing language is announced** in the new language — otherwise the whole page silently turns into another script | ✅ verified: `role="status"` fires *"Language changed to English."* |
| LV | At 320 px the two option cards wrap and do not clip | ☐ |
| DH | Nothing audio on this screen | ✅ |
| MO | Two targets ≥ 48 px; native radiogroup arrow keys | ✅ (52 px) |
| CO | Says *"You can change this at any time"* | ✅ (hint) |
| LL | Icons on both options; Amharic and English render in their own scripts | ✅ |
| DB | Language names are text, not flags | ✅ |

**Known trade-off:** read-aloud is deliberately **off** on this step — we cannot know which voice to use before the answer. Icons and native script carry it instead. Say this out loud if a judge asks; it reads as a considered decision rather than an omission.

### `checkbox` — "How would you like this form to work for you?" (`accessibility-prefs`)
*File: `fields.tsx` · `App.tsx` (`applySupport`)*

> Renamed and narrowed in v1.2: it used to also contain "talk to a person", which cannot work
> in a `localOnly` field. That request is now the separate `assistance` step below.

| Group | What must be true | Status |
|---|---|---|
| SR | Group name = the `<h1>`; each checkbox reads its own label; count announced natively | ☐ |
| SR | **Turning an accommodation on changes the page — so it must be announced** | ✅ verified: *"text is now bigger."* |
| SR | "I prefer not to say" clears the others — **must be announced**, not silently true | ✅ verified: *"Your other choices were cleared."* |
| LV | Bigger text applies immediately without moving focus or losing answers | ☐ |
| DH | Every option has text; icons are `aria-hidden` decoration | ✅ |
| MO | Five targets ≥ 48 px, stacked, no drag | ✅ (52 px) |
| CO | Choosing "I prefer not to say" is a complete answer — never a dead end | ✅ |
| LL | Icons + simple labels + read-aloud of the question | ✅ |
| DB | Icons are decoration; all meaning is in text | ✅ |

**This is the highest-value field in the whole product.** If a judge sees only one thing, show them that choosing "bigger text" changes the form *and* announces it.

### `radio` — "Would you like a person to help you?" (`assistance`)
*The only step that turns a promise into a phone call.*

| Group | What must be true | Status |
|---|---|---|
| SR | Two options, group named by the `<h1>`; the disclosure is in the hint, before the choice | ✅ |
| SR | The choice `call-me` reaches the server — verify with `GET /api/submissions/{id}` | ✅ tested in `tests/submit.mjs` |
| LV | Wraps at 320 px; selected state = border + tint | ✅ |
| MO | 52 px rows, arrow keys native | ✅ |
| CO | A plain "No, I will fill it myself" — refusing is one tap, not silence | ✅ |
| LL | Icons on both options; read-aloud of the question **and** the disclosure | ✅ |
| DB | Text only, no icon-only meaning | ✅ |
| **Privacy** | Stores `assistance` but never `accessibility-prefs`; nothing about health ever asked | ✅ three-way enforcement |

### `text` — name
| Group | What must be true | Status |
|---|---|---|
| SR | Label, hint (`given, father's, grandfather's`), value, error in that order via `aria-describedby`; hint before error | ☐ |
| LV | 52 px control, 2 px border at ≥ 3:1, no fixed height at 200 % | ☐ |
| DH | Nothing audio-only; read-aloud is an addition, not the source | ✅ |
| MO | `inputmode="text"`; Enter submits the step; no timeout | ☐ |
| CO | Error says *"This needs an answer"* — not *"Invalid input"* | ✅ |
| LL | Read-aloud button, example in the hint, one question on screen | ✅ |
| DB | Plain native input — braille typing works | ☐ |

### `tel` — phone
| Group | What must be true | Status |
|---|---|---|
| SR | Digits are read individually; the example `0912 345 678` is in the hint, not the value | ☐ |
| LV | Same as text | ☐ |
| DH | — | ✅ |
| MO | `inputmode="tel"` opens the numeric keypad (big win on a cheap Android) | ✅ |
| CO | Spaces, dashes, `09…`, `07…`, `+251…` all accepted — a citizen is never scolded for typing their own number | ✅ (normaliser) |
| LL | Read-aloud of the question; the error repeats the example | ✅ |
| DB | — | ☐ |

**Voice input on this field — CLOSED this pass.** Amharic ASR returns *words* ("ዘጠኝ አንድ አንድ"), so `digits.ts` converts before the confirmation card, and the card shows **both** lines — *"We heard: ዘጠኝ አንድ አንድ …"* / *"We will use: 911234567"* — so nothing is silently rewritten.
Verified end to end (stubbed recogniser): spoken digits → `911234567` → passes validation.
It also handles amounts: *ሁለት መቶ ሰላሳ አምስት* → `235`, *ሁለት ሺህ* → `2000`.
**It refuses to guess:** one word it does not know ("…ተጨማሪ") and the transcript is left exactly as spoken.
Test: `npm run voice`. 15 unit cases, see §4. | ✅ |

### `radio` — "How can we confirm who you are?"
| Group | What must be true | Status |
|---|---|---|
| SR | Five options, count announced, arrow keys move between them natively | ☐ |
| LV | Cards wrap at 320 px, selected state is not colour-only (border + tint + tick) | ☐ |
| DH | — | ✅ |
| MO | 52 px rows; arrow keys or Tab | ✅ |
| CO | **"Refer me to a partner" is visible as a first-class answer** — this is the whole point of the field for someone with no document | ✅ |
| LL | An icon per option | ✅ |
| DB | Icons decorative; labels carry meaning | ✅ |

**Closed this pass.** Choosing "refer" adds a question (7 → 8). The progress text now *and* the live region both change:
*"ደረጃ 5 ከ 8 — አዲስ ጥያቄ ተጨምሯል።"* ("Step 5 of 8 — a new question was added"). Verified. | ✅ |

### `statement` — partner referral consent (`pii: personal` + `sharing`)
| Group | What must be true | Status |
|---|---|---|
| SR | One checkbox with its own label; the `<h1>` is the question; no duplicate legend | ✅ |
| SR | **No microphone on this screen** — a transcript must never look like consent | ✅ validator `E22` + renderer guard |
| LL | Read-aloud available and reads the body **and** the consent line | ✅ (was missing; fixed in v1.2) |
| LV | The body panel wraps at 320 px | ☐ |
| CO | Consent copy names **what is shared and with whom** ("only your name and phone, with AAAPD") | ✅ |
| MO / DH / LL / DB | Standard checkbox, text-only | ✅ |

**Content gap worth 30 seconds of your time:** "I agree that my information is used for the learning programme" does not say *what* information or *who* sees it. Rewrite it as a sentence a person can refuse.

### `review` — check your answers
| Group | What must be true | Status |
|---|---|---|
| SR | `<dl>` reads as term → definition; each Change button carries visually-hidden context (*"Change — What is your name?"*) | ✅ |
| LV | Rows wrap; no horizontal scroll at 320 px | ✅ verified |
| MO | Change buttons ≥ 48 px (were 44 px — fixed this pass) | ✅ |
| CO | One screen, every answer editable, no re-entry (3.3.7) | ✅ |
| LL | Question + answer pairs, no jargon | ✅ |
| DB | Fully textual | ✅ |

### `submit` — consent + finish
| Group | What must be true | Status |
|---|---|---|
| SR | Submit is a native `<button type="submit">`, never disabled; consent checkbox has its own label | ✅ |
| MO | Enter inside the form submits; 52 px target | ✅ |
| CO | No timer anywhere in the flow; nothing is lost on a failed validation | ✅ |
| All others | Text-only, native | ✅ |

---

## 3. Job and employer forms

### `select` — job category
| Group | What must be true | Status |
|---|---|---|
| SR | First option says **"Choose one"**, not `—` (fixed this pass) | ✅ |
| MO | Native picker; no custom listbox | ✅ |
| LL | Native selects cannot show icons — the label must carry it | ⚠️ accepted limitation |

### `number` — years of experience
| Group | What must be true | Status |
|---|---|---|
| SR | Rendered as `type="text" inputmode="numeric"` so screen readers do not get a spinner | ✅ |
| CO | Hint says *"A number only. Write 0 if you have not worked"* — zero is a valid, non-shameful answer | ✅ |

### `email`, `textarea`
| Group | What must be true | Status |
|---|---|---|
| SR | Optional marked in words, never an asterisk | ✅ |
| CO | `textarea` has a visible hint about length; no character counter that scolds | ✅ |

### `file`, `date-ec-gc`
**Not enabled in any live form.** Their renderers exist for adopters. Do not demo them until these are checked: camera-only capture is a trap; a date input must never reject a year-only answer.

---

## 4. Gaps found in this pass

| # | Gap | Status |
|---|---|---|
| 1 | Language change re-rendered the page silently | **fixed** — live region |
| 2 | "Prefer not to say" wiped other choices silently | **fixed** — announced |
| 3 | Support choices resized the page silently | **fixed** — announced |
| 4 | `review` Change buttons were 44 px, under the 48 px rule | **fixed** |
| 5 | `select` placeholder was `—` | **fixed** — "Choose one" |
| 6 | Consent checkbox on referral/submit never rendered at all | **fixed earlier** (blocking bug) |
| 7 | Conditional step count changes were not announced | **fixed** — live region, verified |
| 8 | Amharic number words from ASR were not converted to digits | **fixed** — `digits.ts`, verified end to end |
| 9 | Error summary is both `role="alert"` and focused | **reviewed, kept** — see below |
| 10 | Pressing Continue twice with the same errors gave no feedback | **fixed** — re-focuses the summary on every failed attempt |
| 11 | Switch access, voice control, braille display | **untested** — needs hardware, cannot be closed from here |
| 12 | **The Ethiopic font was subset to our own UI strings, so any character the user typed could render as a tofu box** — `ዘ` was missing from *"ዘጠኝ"* in a voice transcript | **fixed** — full 384-codepoint face, `tests/font-coverage.py` guards it |

### Gap 9 — why the error summary stays as it is

I went to check whether our error summary double-announces. Our markup happens to be **byte-for-byte the GOV.UK pattern**: `role="alert"` + `aria-labelledby` on the title + `tabindex="-1"` + focus moved to it on a failed submit. That is the single most-tested error pattern on the web — almost every UK government form uses it, with NVDA, JAWS, VoiceOver and TalkBack.

So the honest answer is: *do not invent a novel pattern two days before judging.* A local fix (polite live-region instead of alert) would trade a known-good pattern for an untested one. Ask the co-designer to submit the empty form once and tell you whether it read twice. If it does, the fix is one attribute — but do not change it on a hunch.

---

## 5. Order to run it in (12 hours, be honest about what fits)

| When | What | Why first |
|---|---|---|
| Sat 13:00 | The 8 gate-path fields with the co-designer, SR column only | 30 of 100 points ride on the blind/low-vision path, and SR is where forms break worst |
| Sat 16:00 | MO column on the same 8 — keyboard only, no mouse | Second-largest silent failure mode |
| Sun 09:00 | LV column — 200 % zoom and forced-colors on every step | Cheap, finds layout bugs fast |
| Sun 13:00 | **The gate rehearsal** — all five conditions at once, unaided | This is the actual judged task |
| Sun 14:30 | CO and LL columns with the co-designer | These feed the 30-point "works for the people it is for" score |
| If time | DH, DB columns | Mostly already true: nothing is audio-only |

### Gap 12 — the one worth telling the judges about

The font was subset to the 153 fidel that appear in our own strings, because that is the obvious optimisation: 194 KB → 38 KB. It was wrong. A form accepts text we did not write — a name typed in Amharic, a voice transcript — and every character outside our subset rendered as a box. In the screenshot, the ASR hears *"ዘጠኝ"* and the user sees *"⯑ጠኝ"*.

Fixed by shipping the whole block (384 assigned codepoints, one variable file, 136 KB) and adding `tests/font-coverage.py`, which fails if any assigned Ethiopic codepoint stops rendering.

**The general rule this exposes:** any optimisation that assumes the content is ours is an accessibility bug waiting for a user to type. Check every one of them — placeholder text, validation regexes, fonts, the "simple words" rewrite dictionary.

**Do not** run this matrix alphabetically, and do not tick a box because axe passed. Axe catches roughly half of what this document asks about; the other half is a person pressing Tab.

---

## Connection states

Not fields, but they are surfaced to the user and they must not shout.

| State | What is shown | How it is announced | Colour |
|---|---|---|---|
| Online, nothing queued | nothing | — | — |
| Offline, filling the form | `.op-net` banner: "No connection. Your answers are kept on this device…" | `role="status"` on the banner; a one-off polite announcement on the change, never repeated per keystroke | navy on `--op-primary-tint` (14.19:1) — **never** brand red: being offline is not the learner's mistake |
| Submit failed | done screen: "Saved on this device", + a "try sending now" button | `role="status"` on the receipt line; `h1` focus on the state change | navy + brand red only on the warning icon |
| Storage refused the entry | "This device would not store it… please do not close it" | same | brand red icon, `--op-error-text` for the sentence |
| Sent | reference number, `op-mono`, on its own line | polite | `--op-ok` |

The banner is **in normal flow**, not fixed or floating: a toast that covers the bottom of the
screen hides the control someone just focused (SC 2.4.11). `npm run focus` enforces that.
