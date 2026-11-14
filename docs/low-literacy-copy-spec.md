# Low-literacy copy and icon spec

**For:** whoever owns the low-literacy path (Dev C in `docs/parallel-build-plan.md`)
**Written:** 13 Nov 2026 · **Owner of the language:** the native Amharic speaker on the team. Every
draft below is a proposal to accept, edit or reject — not a finished string.

---

## 1. What is actually there

Simple mode is **wired and rendering**: the top-bar toggle re-renders every screen, 20 of 23 steps
carry a `simple` line, and `questionText()` prefers it when the toggle is on. It is *not* missing.

But the strings themselves are mostly not simpler — they are shorter. Measured across the three
forms (`npm run literacy`):

| | Count |
|---|---|
| Steps with a `simple` line | 20 of 23 (the three `submit` screens have none) |
| …where the simple string is **a single noun** | **18** |
| …where the simple string is a phrase | 2 (`እርዳታ በስልክ`, `የሥራ ጊዜ`) |
| …where the simple string contains a verb | **0** |

Examples of what a low-literacy learner gets today:

| Full heading | Simple heading today | The problem |
|---|---|---|
| ስምዎን ይጻፉ — *write your name* | **ስም** — *name* | The full version is 8 characters and already plain. The simple version replaces an instruction with a label, and the learner has to infer "type it here" from a page whose only heading is a noun. **This is a regression, not a simplification.** |
| ማንነትዎን እንዴት እናውቃለን? — *how do we know who you are?* | **ማንነት** — *identity* | "Identity" is an abstract noun the shortest version of which nobody uses in speech. |
| ወደ አጋር መመራት — *referral to a partner* | **አጋር** — *partner* | This is a consent screen. A bare noun does not tell anyone what they are agreeing to. |
| ቅጹ እንዴት እንዲሠራልዎት ይመርጣሉ? | **እርዳታ** — *help* | Same word as two other, unrelated screens (`job-support`, `accommodations`). Three questions, one heading. |

**The rule that produced this is the bug:** the copy was optimised for *length*. Length is a
ceiling, not a target. What makes a question easier is **grammar and word choice**, not character
count.

---

## 2. Rules for simple copy

| # | Rule | Why |
|---|---|---|
| **R1** | **A simple heading is a complete instruction or a direct question — it contains a verb.** `ስምዎን ጻፉ`, `ስንት ዓመት ሠሩ?` Allowed exception: a single-word imperative (`ጨርስ`, `ቀጥል`) where the screen has exactly one action. | A noun is a label. A form needs instructions. |
| **R2** | **Length is a ceiling:** ≤ 5 words and ≤ 70 % of the full string. Never aim for the shortest possible string. | Above 5 words a person re-reads; below 2 words they guess. |
| **R3** | **One idea per sentence.** No subordinate clauses, no `እንደ…`/`ቢ…` constructions stacked. | Working memory, not reading skill. |
| **R4** | **Everyday spoken word, not the written/administrative register.** If a word appears in a form letter but not in a phone call, replace it. | The register is the barrier, more than the length. |
| **R5** | **No simple string may be reused for two different questions in the same form.** `npm run literacy` fails on a duplicate. | Two screens that look identical make people think the form jumped back. |
| **R6** | **Simplification must never remove a safety or privacy word.** "Nothing about your health is sent" survives simplification intact — if it does not fit, shorten the rest of the sentence. | The person most at risk is the one least able to read the disclaimer. |
| **R7** | **Hints keep their example.** `ምሳሌ፦ 0912 345 678` stays in every version; an example teaches format better than a rule. | One worked example beats three sentences of explanation. |
| **R8** | **Errors say what to do, in ≤ 8 words, and name the field.** | "Enter a phone number like 0912 345 678", not "invalid input". |

**Method for writing a simple string (10 minutes per string, do it out loud):**

1. Say the full question out loud as if asking a colleague. Write down what you actually said —
   that is usually the simple version.
2. Cut every word that is not needed to act on it.
3. Check the verb is at the end (Amharic word order) and it is the plain imperative, not the
   formal/administrative one.
4. Read it to someone who did not write it. If they ask a question back, it is not done.
5. If after all that the simple version is not clearly better than the full one — **delete the
   `simple` line and let it fall back.** Falling back is a valid answer.

---

## 3. Proposed rewrites — for the native speaker to accept, edit or reject

Drafts written to R1–R8. The Japanese/quotation marks are the point: **you decide.**

| Form | Step | Full (am) | Simple today | Proposed draft | Note |
|---|---|---|---|---|---|
| onboard | language | ቋንቋ ይምረጡ | ቋንቋ | *(delete — keep full)* | Already 2 words with a verb. |
| onboard | accessibility-prefs | ቅጹ እንዴት እንዲሠራልዎት ይመርጣሉ? | እርዳታ | **ቅጹ እንዴት ይሁን?** | Must not be the same word as the assistance step. |
| onboard | assistance | አንድ ሰው እንዲያግዝዎ ይፈልጋሉ? | እርዳታ በስልክ | **ሰው ይደውልልዎ?** | Question form; the phone call is the point. |
| onboard | name | ስምዎን ይጻፉ | ስም | **ስምዎን ጻፉ** | One word shorter, still an instruction. |
| onboard | phone | ስልክ ቁጥርዎን ይጻፉ | ስልክ | **ስልክ ጻፉ** | |
| onboard | id-route | ማንነትዎን እንዴት እናውቃለን? | ማንነት | **መታወቂያ ይምረጡ** | The screen is a list of 6 documents; say so. |
| onboard | id-value | የመታወቂያ ቁጥር | ቁጥር | **መታወቂያ ቁጥር ጻፉ** | |
| onboard | referral | ወደ አጋር መመራት | አጋር | **ስምና ስልክ እንስጥ?** | Consent: say *what* is given, not who to. |
| onboard | submit | ማረጋገጫ | — | **ጨርስ** | Single-word imperative — allowed by R1 exception. |
| job | job-name | ስምዎን ይጻፉ | ስም | **ስምዎን ጻፉ** | |
| job | job-phone | ስልክ ቁጥርዎን ይጻፉ | ስልክ | **ስልክ ጻፉ** | |
| job | years-experience | ስንት ዓመት ሠርተዋል? | ዓመት | **ስንት ዓመት ሠሩ?** | Plain perfect, not the formal form. |
| job | experience | ያደረጉትን ሥራ ይንገሩን | ሥራ | **ሥራዎን ንገሩን** | |
| job | job-email | ኢሜይል | ኢሜይል | **ኢሜይል ጻፉ** | A noun is not an instruction. |
| job | availability | እንዴት መሥራት ይመርጣሉ? | የሥራ ጊዜ | **የሥራ ጊዜ ይምረጡ** | |
| job | job-support | ለቃለ መጠይቁ እርዳታ ይፈልጋሉ? | እርዳታ | **በቃለ መጠይቁ እርዳታ?** | ⚠ must not duplicate the prefs heading. |
| job | submit | ማረጋገጫ | — | **ጨርስ** | |
| employer | company | የድርጅቱ ስም | ድርጅት | **የድርጅትዎን ስም ጻፉ** | |
| employer | role | የሥራው ዓይነት | ሥራ | **የሥራውን ዓይነት ጻፉ** | |
| employer | job-category | የሥራው ክፍል | ክፍል | **የሥራውን ክፍል ይምረጡ** | |
| employer | accommodations | ድርጅትዎ ምን ይሰጣል? | እርዳታ | **ምን ይሰጣሉ?** | Third use of እርዳታ today. |
| employer | contact | የመገኛ ስልክ ቁጥር | ስልክ | **ስልክ ጻፉ** | |
| employer | submit | ማረጋገጫ | — | **ጨርስ** | |

Then the same work for **hints** (`hint.simple`, R7) and **errors** (R8) — 11 hints and 8 error
rules. Neither exists today in any schema.

---

## 4. Icons: one icon, one meaning

Every option already has an icon (`noIcon: 0`), so the plumbing is fine. What is wrong is that
the same icon means several different things, and a learner who cannot read is relying on it:

| Icon | Used for | Problem |
|---|---|---|
| `speaker` | አማርኛ (language), ጥያቄዎች እንዲነበቡልኝ (read aloud), የስክሪን አንባቢ ሶፍትዌር (screen-reader software) | Three meanings: *spoken language*, *read this to me*, *assistive software* |
| `doc` | ፓስፖርት, ሌላ ሰነድ, ምንም መታወቂያ የለኝም, ጥያቄዎች በጽሑፍ, ሌላ | Five meanings, including one that is the *absence* of a document |
| `door` | ጸጥ ያለ ክፍል (quiet room), ያለ ደረጃ መግቢያ (step-free entry) | Two meanings — a quiet space is not an entrance |
| `building` | በቢሮ መሥራት (work in an office), እንግዳ አገልግሎት (hospitality) | Plausible, but the two jobs look identical |
| `none` | መረጃ መስጠት አልፈልግም (prefer not to say) | The only option with no icon — the odd one out is legible as "different" but not as "opt out" |

**Rules**

| # | Rule |
|---|---|
| **I1** | One icon = one meaning across all three forms. If a meaning is needed twice, draw a second icon; do not reuse. |
| **I2** | An icon must be guessable without its label. Test: show it to 5 people who did not design it; ≥ 4 must say the same thing, or it fails. |
| **I3** | Every option has an icon, including "prefer not to say" (a crossed-out circle, not absence). |
| **I4** | The icon never carries meaning alone — the label is always present (WCAG 1.1.1). Icons support the label, they do not replace it. |
| **I5** | One silhouette, no embedded text, legible at 24 px and at 200 % zoom, inherits `currentColor` so it passes contrast in every state. |
| **I6** | No icon that depends on a cultural reference the target user may not share (no letterforms, no English words inside the icon). |

**The 5-person test is the acceptance test.** It is also a perfect 15-minute task for the
co-designer sessions: ask them what each icon means before they read the label.

---

## 5. Acceptance criteria

```bash
npm run literacy          # report: renders every screen in simple mode, flags nouns
npm run literacy:strict   # fails on a single-noun heading — flip this on when the copy lands
npm run controls          # read-aloud + microphone on every screen, all three forms
npm run check             # the gate
```

| Criterion | How it is checked |
|---|---|
| Every simple heading is a phrase with a verb (or a documented single-word imperative) | `npm run literacy:strict` |
| No two questions in a form share a simple heading | `npm run literacy` |
| No screen loses its heading in simple mode | `npm run literacy` |
| Simple mode reaches the review and done screens, not only the questions | already wired (`ReviewScreen` takes `simple`) |
| Simple string ≤ 5 words and ≤ 70 % of the full string | `schema/validate.mjs` — **W12**, not yet written; 30 minutes |
| Icon guessing test | 5 people, ≥ 4 agree, per icon |

**Definition of done for this workstream:** `npm run literacy:strict` passes, W12 exists and
passes, and 5 people have guessed the icons. Anything less is a shorter string, not a simpler one.

---

## 6. Why this is a thinking task, not a typing task

Two afternoons of typing could fill 20 `simple` fields. That is exactly how the current 18 nouns
got there. The work is:

1. **Listening to how the question is actually asked out loud** — the form's register is the
   barrier, not its vocabulary.
2. **Deciding when a screen is already simple enough** and deleting the `simple` line instead of
   shortening it.
3. **Auditing the icons as a set**, not one at a time, because the failure is a collision between
   two icons that are each individually fine.
4. **Testing with people**, because "this is clearer" is a claim about someone else's head.

That is the difference between a form that passes an audit and a form a person finishes.

---

## The language screen in simple words (decided 13 Nov)

These are **simple-words variants**, not replacements. The default screen keeps its original copy;
"Simple words" in the settings bar swaps in the shorter version, exactly as it does for a question
heading. Getting this wrong the first time is why the rule is worth writing down: *a simpler
sentence is an alternative, not a substitute* — a confident reader who is not low-literacy should
not be talked to in five-word sentences, and a person who needs them should not have to ask twice.

| Layer | Text |
|---|---|
| Default question | **Choose your language** · ቋንቋ ይምረጡ |
| Simple question | **Pick your language** · ቋንቋ |
| Default intro | *First choose your language and any help you need. Then answer a few questions. There is no time limit.* · አስቀድመው ቋንቋዎንና የሚፈልጉትን እርዳታ ይምረጣሉ። ከዚያ ጥቂት ጥያቄዎችን ይመልሳሉ። ጊዜ ገደብ የለም። |
| Simple intro | **Take your time. No rush.** · ያለምንም ችኮላ ቀስ ብለው ይሙሉ። |

Why "Pick" and not "Choose": the default screen says *choose* three times (heading, hint, the
"Choose one" helper). "Pick" is the word people say out loud. In the simple layer the heading also
stops being a bare noun — `simple.mjs --strict` wants a phrase there, and "Pick your language" is
one, where "Language" was not.

**Implementation note.** The intro had no simple variant until now: `intro` was a single pair of
strings. It is now `intro` + `introSimple`, and the renderer, `readAloudText()` and the audio
manifest all pick by mode — so turning simple words on changes **what is spoken** as well as what is
read. Without that last part read-aloud would have said the long paragraph over the short one, which
is the same class of bug as a screen that shows text nobody speaks.

`voice.mjs` asserts the four states: default text, simple text differs, read-aloud follows the mode,
and turning the toggle off restores the original intro.

### The icons: a script letter, not a flag

The Amharic and English choices used a speaker and a book — neither meant "language", so they were
replaced by the script itself: **አ** and **A**. Flags were considered and rejected:

- **A language is not a country.** Amharic is spoken in Ethiopia and Eritrea; English is the first
  language of dozens of states. Any flag chosen for "English" is a wrong answer to a question we
  are not asking.
- **This form never asks nationality.** It serves displaced people; a flag pair turns "which
  language do you read" into "which country are you from", which is exactly the sensitive question
  the privacy copy promises not to collect.
- **It is not even reliable on the hardware we target.** Windows Chrome ships no flag emoji — it
  renders `ET` and `GB` as two letters, so the "picture" becomes an abbreviation beside a label.

Anyone who reads either script recognises its own letter instantly, it needs no image download, it
inherits text colour and size, and it is `aria-hidden` — the radio label still supplies the
accessible name, so a screen reader hears "Amharic, radio button, 1 of 2", never "letter A".

The question icon is now a **speech bubble with two lines of writing** (`chat`) instead of a group of
people: people read as "about you or your family", writing reads as "words". Icons are shared by both
modes; only the wording is mode-specific.

Measured: both choices stay on one line at 200 % text zoom in a 390 px viewport, and the page still
needs no horizontal scroll.

### The simple layer covers every line, not just the heading (13 Nov)

Hints, bodies, whys and option labels now have simple-words forms (`simpleHint`, `simpleBody`,
`simpleWhy`, `option.simple`), because the sentences that carried the jargon were the hints and
bodies — "partner organisation" (አጋር ድርጅት), "How can we confirm who you are?", "Referral to a
partner organisation". A simple heading over a corporate paragraph reads worse than no simple mode
at all.

| Screen | Simple form |
|---|---|
| 2 · help | **ቅጹ እንዲመችዎ ይምረጡ** / *Make this easier to use* · hint **የሚፈልጉትን እርዳታ ይምረጡ። በኋላም መቀየር ይችላሉ።** · option **ጥያቄዎቹን ያንብብልኝ** / *Read questions aloud* |
| 3 · help by phone | heading **እርዳታ በስልክ** · hint **አንድ ረዳት ይደውልልዎታል። ስምዎንና ስልክዎን ብቻ ነው የምንሰጠው።** |
| 6 · ID | **መታወቂያ አለዎት?** / *Do you have an ID?* · hint **መታወቂያ ባይኖርዎትም ችግር የለም። እንረዳዎታለን።** · last option *I have no ID* |
| 7 · ID number | hint **ቁጥሩን ካላወቁት መዝለል ይችላሉ።** |
| 8 · referral | **በስልክ እርዳታ ማግኘት** / *Get help by phone* · 3-sentence body · consent **አዎ፣ ስሜና ስልኬ ይሰጥ** |
| 9 · submit | **ለመጨረስ ዝግጁ ነዎት?** / *Ready to finish?* · consent **መረጃዬ ለትምህርቴ እንዲውል ተስማምቻለሁ።** |

**Two rules that came out of doing this:**

1. **A promise may not be simplified away.** The long assistance hint said *"We share nothing about
   your health."* Shortening the hint to two sentences would have dropped the strongest privacy
   statement in the form, so it moved to the simple `why` line instead and stays on screen.
2. **The simple text must be the text that gets spoken.** `readAloudText()` reads `hintText()`,
   `bodyText()` and `optionText()` — the same helpers the screen renders — and `voice.mjs` asserts
   that the heading and hint a person sees in simple mode are the ones "Read the question" says.
   Without that, turning on simple words would have shown five words and spoken twenty-three.

Also fixed while here: `scripts/audio-manifest.mjs` carried its **own copy** of the string walk
instead of importing `scripts/_strings.mjs`. It had silently missed the simple-words strings, so the
recording checklist would have shipped without 64 of the 222 clips. There is now one collector.

### One question, one answer: the double call offer (13 Nov)

Step 3 asked *"Would you like a person to help you?"* and, if the person also had no ID, the referral
step asked a second time — *"share your name and phone number so a partner organisation can call
you"*. Two screens, one decision, and the second one reads like the form did not listen.

The fix is to ask **once**: the referral step now appears only when the person has *not* already said
yes (`referral.showIf` = id-route has no document **and** assistance = *No, I will fill it myself*).
Choosing "Yes, call me" is the consent — that step's own hint already discloses exactly what travels
(*"A helper will call you. We only share your name and phone number."*) — so the later screen would
be a second signature on the same form.

**What was rejected.** Auto-ticking the referral consent checkbox when the person said yes earlier.
A pre-selected consent box is not consent: it records agreement the person never gave, and it breaks
this project's own rule that consent is never dictated. Skipping the step records the same
information honestly — the "yes" is in `assistance`, and the disclosure was on screen when they gave
it. If the referral consent is ever needed as its own record, the right fix is to make step 3's
option label explicit (*"Yes, call me and share my name and phone number"*), not to pre-tick a box.

`showIf` now accepts several conditions, all of which must hold — one condition could not express
"no ID **and** declined the call", and the failure mode of that gap was this double ask.

### The document icons (13 Nov)

`passport` was left pointing at `letter-en` — the letter **A** used for English on step 1 — so the
third option on the ID screen read as a Latin letter. It now has its own icon: a booklet with an
emblem. The lesson is about the edit that caused it: a search-and-replace for `"icon": "book"` hit
two different meanings, because "book" was serving both "English" and "passport". Icons are shared
vocabulary, so a replacement must be checked against **every** place the old name appears, not just
the one that prompted it (`grep` before, render after).

### Two sentences about the same data are written together

The hint and the why of one question are read by the same person, seconds apart.
If they disagree about who will see the answer, the person cannot tell which one
is true — and on a health-adjacent field, that is the sentence that decides
whether they answer honestly or abandon the form.

So: when a field's privacy wording changes, both lines change in the same edit,
and the simple layer too. The schema's `sharing.recipient` is the single source
of truth; the hint, the why and the badge all restate that one value and nothing
else. Rule E24 in `validate.mjs` fails the build on the crudest form of a
contradiction, but it cannot catch a paraphrase, so the editorial rule carries
the rest.

### A consent line names what is actually sent

The confirmation checkbox said "I agree to share my name and phone number with the
employer". The form sends six things: name, phone, email, work history, working
hours, and interview support. The simple twin was worse — it named two fields.

On a consent line, understating is not a simplification, it is the defect itself:
the person agreed to something narrower than what happens next. So a consent twin
may be plainer, but it may not be shorter *in scope*. Name the fields in both
layers, and keep the simple version shorter only in its words.

When you add a field to a form that is shared with a recipient, the consent line is
part of the change, not a follow-up.
