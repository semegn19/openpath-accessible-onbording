# Why the job form was thinner than the sign-up form — and how that is now checked

**The problem.** The learner sign-up form had grown a welcome line, a "why we ask this" under most
questions, a simple-words variant for every screen, and a complete set of written error messages.
The job application had none of that: no intro, no *why*, a two-key `ui` block, three error rules
with no message, and no simple layer at all. Both forms are the same product. A person applying for
a job got a form that explained less than the form they had just used.

Nothing broke, which is why it survived: a missing `ui` key falls back to a hardcoded string, a
missing `why` simply renders nothing, and a missing error message renders an empty string.

**What the job form now has**, in the same shape as the sign-up form:

| | Before | Now |
|---|---|---|
| Welcome line | — | *Answer a few questions about your work. There is no time limit.* + a simple-words twin |
| `ui` strings | 2 (`choose`, `speak`) | 13 — every string the app can print |
| Error messages | 8 rules, 3 of them unnamed | every rule the form can raise, in both languages |
| *Why we ask this* | 2 of 7 questions | all 7 |
| Hints | 3 | 6, each with a simple twin |
| Simple-words layer | none | heading + hint + why + option labels |
| Icons | already complete | unchanged |
| Name validation | `required` | `required` + `minLength 2`, matching sign-up |

**What the parity test enforces** (`npm run parity`, part of `npm run check`):

1. every `ui` key the richest form declares exists in the others;
2. every validation rule a form can raise has a written message, in both languages;
3. `{placeholders}` appear only in messages whose rule supplies the number;
4. there is a welcome line and a simple-words version of it;
5. no screen asks for something without explaining it, and every field holding personal data says
   *why* — the rule reads `hint`, `body` or `why`, because a statement screen explains itself in its
   body;
6. every question has an icon;
7. a long option label has a short twin, a long heading has a simple one;
8. **a simple twin that is word-for-word the default counts as a failure** — it is not simpler, and
   it is a second clip to record and pay for;
9. the review status is honest (`reviewed`, or something containing `unreviewed`).

Point 8 caught 16 twins I had just written by rote. Points 5 and 7 caught two gaps in **sign-up**,
the form I had been treating as the reference: the referral screen had no written reason, and two
options ("No, I will fill it myself", "I need help choosing") had no short form. Fixing the reference
was the right direction — a parity test that only ever looks down at the poorer forms cannot find
what the richer one is missing.

**Both forms now open the same way.** Step 1 is the language question (with the two script-letter
icons) and step 2 is the accessibility preferences — read the questions to me, bigger text, simple
words. Same wording in both forms, on purpose: someone who has seen one Savanna form should not have
to learn a second one. The preference options declare what they change (`applies`), and `App.tsx`
now recognises that step by **those options** rather than by a hardcoded step id, so a third form
gets the behaviour for free.

The job form went from 9 screens to 11; `controls.mjs` walks all 11 and confirms every one still has
read-aloud and a microphone, with neither on the consent screen.

**The setup screens show the state, they do not ask about it.** Both steps used to open blank: the
form was in Amharic while neither radio was selected, and "Simple words" could be switched on from
the bar at the top while its checkbox sat empty. Two controls, one switch, opposite answers.

Now the applied setting drives what is shown:

- the language radio starts on the language in use, and changes when the bar changes it;
- the preference checkboxes are ticked exactly for what is on, and un-ticking one turns it off again
  (previously the step could only ever turn things *on*, so a box could not be cleared from the
  screen that owns it — and a checkbox that cannot be un-ticked is a claim, not a control);
- the stored answer is kept in step with the applied state, so validation, the review screen and the
  submitted payload all agree with what is on screen. Without that last part the radio looked right
  while `Next` refused to move, because the *value* was still empty.

One consequence: the language question can no longer be left blank, so the empty-error path is
exercised on a required text field instead (`a11y.spec.mjs` now does that at the name step, where it
also confirms focus lands on the error summary). `controls.mjs` asserts, on both forms, that the
radio and the checkboxes match the settings bar in both directions.

**All three forms are at parity as of 13 Nov.** The employer form was the last one behind — 12 `ui`
keys and a whole explanatory layer — and it is now treated identically: the same two opening screens
(language, then accessibility preferences), a welcome line, the full `ui` vocabulary, a written
message for everything it can complain about, a *why* under every field including the optional ones,
and a simple-words twin for each long heading and label. `tests/parity.mjs` has **no exemptions
left**; the `EXEMPT` map is now empty, and the next form that falls behind fails the build by name.

**About the new Amharic.** Everything added to the job form is new Amharic that no native speaker has
read. `contentStatus` for that file is now `partly-unreviewed`, and `contentReview` says so in both
languages. It must not be flipped back to `reviewed` until someone reads it aloud.

## A sentence can contradict the schema, and no schema check will notice

The interview-support step declared `sharing.recipient: employer`, and said so in
its hint. Its `why`, one line below, said the opposite: that only the person and
the programme team would see it. `validate.mjs` was green throughout, because
E23 checks the `sharing` object — who receives the field, at what PII level, in
which payload. It cannot read prose.

Rule **E24** now closes the narrowest useful part of that gap: a step that
declares a sharing recipient may not describe itself as visible only to the
person. It matches "only you and …" and its Amharic form, and deliberately not
the word "only" on its own, because "we share only your name and phone number"
is a true sentence about sharing and must keep passing.

The rule is a tripwire, not a proof. The real defence is editorial, and it is now
written into the copy spec: **two sentences about the same data get written in
the same sitting.** The bug existed because the hint was edited in one pass and
the why in another, months apart.

## `type` describes the answer, not the widget

`job-category` asked a closed question with six options, each carrying an icon, and declared
`type: "select"`. A dropdown cannot draw an icon, so all six icons were silently dropped, all six
choices hid behind one tap, and — the part nobody would notice — the voice path had no option list
to match a spoken answer against. Speaking "Sales" showed the transcript back, took the
confirmation, and left the dropdown on "Choose one". The step is optional, so nothing errored. The
answer was simply gone.

The fix is not a different widget for the same type. It is the right type: a radio group.
Onboarding's `id-route` was already six icon options rendered as cards; `job-category` was the only
`select` in all three forms, so it was the outlier, not the pattern.

Two rules now hold this:

- **E25** — a `select` whose options carry icons is an error. Dropdowns cannot show them.
- **W11** — a `select` that declares `voice: true` warns, because a dropdown has no option list for
  the recogniser to match against.

E25 found a second instance the moment it was added: the same shape in
`schema/templates/example-course-enrolment-v1.json`, the file form authors copy from.

Reserve `select` for lists too long to show as cards — all the woredas in a region, a hundred
courses. If the list is short enough to scan, it is short enough to be cards, and if the options
have icons it must be cards.

## The same button says the same words on every form

The employer form briefly said "Listen" / "Speak answer" in English while the other two said
"Read the question" / "Speak your answer". Every test passed, because each form was only ever
compared against itself. A person moving between the three hears two different words on the same
control — and a tester writing a selector for one form silently misses the other.

`tests/parity.mjs` now compares the shared `ui` strings — read-aloud, speak, choose, next, back,
edit, optional, the confirmation words — across all three forms, in both languages, and fails
naming which form disagrees. Verified to fail by changing one string and watching it report
`speak.en: "Speak your answer" (savanna-onboard-v1, savanna-job-v1) vs "Speak answer" (employer…)`.

Shorter wording is worth having, but not on one form out of three.
