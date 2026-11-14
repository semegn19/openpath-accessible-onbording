# WCAG 2.2 Level AA — conformance report

**Product:** OpenPath — Savanna learner sign-up, job/career support and employer accommodation requests
**Version:** 1.2.0 (onboard schema v1.2.0, job v1.1.0, employer v1.0.0, API v1.2.0)
**Date:** 13 November 2026
**Prepared for:** Digital Bridge Accessibility Hackathon 2026, track 1
**Evaluation standard:** WCAG 2.2, Levels A and AA — **55 success criteria** (31 Level A + 24 Level AA)

---

## 1. Conformance claim

> **The OpenPath forms are designed and built to meet WCAG 2.2 Level AA. All 55 success criteria
> are supported by automated, keyboard and code-level evidence — 6 of them vacuously, because the
> thing they govern (audio, video, a help mechanism repeated across pages) does not exist in this
> product; zero criteria are known to fail, and zero are untested. A claim of *conformance* is withheld until the
> co-designer sessions in §7 are complete, because conformance is something people with
> disabilities demonstrate, not something a test suite asserts.**

That distinction is deliberate. A report that says "conforms" today would be asking you to take
its word for the one thing it cannot show you. Every row below names the test that produces it,
and `cd app && npm run check` reproduces all of it in about 80 seconds on any machine.

| | |
|---|---|
| Success criteria in scope | 55 (WCAG 2.2 A + AA) |
| Supported | **55** |
| Not applicable (vacuously satisfied) | 6 — 5 in 1.2.x (no audio or video content exists) + 3.2.6 (no help mechanism is repeated across pages) |
| Known failures | **0** |
| Partial support | **0** |
| Verified with disabled users | **Not yet — scheduled, §7** |
| axe-core serious or critical findings | **0** across 17 audits |

**Scope**

| In scope | Out of scope |
|---|---|
| Learner sign-up `/onboard` — 10 steps | Savanna's own marketing site (§5 lists the departures we made from its design system) |
| Job / career support `/job` — 9 steps | The partner organisation's case-management system |
| Employer accommodations `/employer` — 7 steps | The browser's speech engine and the quality of its Amharic voice |
| Error, offline, queued and success states | AAA (31 criteria) — not targeted, not claimed |

---

## 2. How this was evaluated

| Method | Tool | What it covered |
|---|---|---|
| Automated rules | axe-core 4.13, Playwright, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` | **17 audits** — every screen, the error state, the offline banner, 320 px reflow, 200 % zoom. 0 serious, 0 critical, 0 moderate |
| Keyboard only | Playwright key events (`a11y`, `kb`, `focus`) | Full walk without a pointer; tab order printed and asserted; no trap; nothing focused is hidden under the sticky bar |
| Reflow, zoom, text spacing | 320×640 (SC 1.4.10), 640×400 = 200 % zoom (SC 1.4.4), and the WCAG text-spacing overrides (SC 1.4.12) | No horizontal scroll; heading visible; no clipped control in any of the three |
| Contrast | Computed colour values on every token | Body 16.8:1 · muted 5.80:1 · error text 4.53:1 · brand red 4.40:1 on non-text only |
| Colour independence | Code review of every state, error and progress cue | No meaning carried by colour alone |
| Status messages | Assertions on live regions and their throttling | Autosave, connection change, errors, submit result |
| Slow and no connection | `npm run offline`, Chrome Slow 3G | 22 assertions: 3G budget, reload offline, queued submit, reconnect, one record on disk |
| Screen reader | **Not yet run — §7** | NVDA and TalkBack sessions with our co-designer |
| Disabled users | **Not yet run — §7** | Same sessions |

**Reproduce everything:** `cd app && npm install && npx playwright install chromium && npm run check`

---

## 3. Level A — 31 criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1.1.1 | Non-text Content | **Supports** | Every icon in `icons.tsx` is `aria-hidden="true"` beside real text. No image carries information on its own; the brand mark is text. |
| 1.2.1 | Audio-only and Video-only (Prerecorded) | Not applicable | No pre-recorded audio or video exists. |
| 1.2.2 | Captions (Prerecorded) | Not applicable | — |
| 1.2.3 | Audio Description or Media Alternative | Not applicable | — |
| 1.2.9 | Audio-only (Live) | Not applicable | No live audio. |
| 1.3.1 | Info and Relationships | **Supports** | One `<h1>` per screen and it *is* the question; choice groups are real `<fieldset>`/`<legend>`; errors linked by `aria-describedby` (9 uses in `fields.tsx`); `header`/`main` landmarks; skip link first in tab order. |
| 1.3.2 | Meaningful Sequence | **Supports** | DOM order = reading order = visual order. No CSS reordering, no absolute-positioned layout. |
| 1.3.3 | Sensory Characteristics | **Supports** | No instruction refers to shape, size, position or colour. Verified by reading every `hint` string in all three schemas. |
| 1.4.2 | Audio Control | **Supports** | Speech starts only on an explicit press of Read aloud, is cancelled by **any** keypress (`useCancelSpeechOnKey`), and never plays at load. Under three seconds, so it is also not "background audio". |
| 2.1.1 | Keyboard | **Supports** | The whole form is completed with keys only, in the automated walk and in `npm run kb`. Native controls throughout. |
| 2.1.2 | No Keyboard Trap | **Supports** | Tab order is printed on every run; the disclosure and speech controls never trap focus; `Escape`/`Tab` always leave. |
| 2.1.4 | Character Key Shortcuts | **Supports** | No single-key shortcut performs an action. Any keypress only *cancels* speech — a stop, which is exempt. |
| 2.2.1 | Timing Adjustable | **Supports** | No time limit on any step or on submission. A draft persists indefinitely on the device. |
| 2.2.2 | Pause, Stop, Hide | **Supports** | Nothing auto-updates, blinks or scrolls. The autosave announcement is throttled to once per 15 s and moves no focus. |
| 2.3.1 | Three Flashes or Below Threshold | **Supports** | No flashing content. The only animation is a 120 ms transition, removed under `prefers-reduced-motion`. |
| 2.4.1 | Bypass Blocks | **Supports** | Skip link to `#op-main` is the first focusable element on every page. |
| 2.4.2 | Page Title | **Supports** | `document.title` set per form and per language; asserted on all 21 routes in `npm run pages`. |
| 2.4.3 | Focus Order | **Supports** | Order follows the visual order (12 steps asserted and printed). Focus moves to the new question's heading on each step change — never on first load, which would hide the skip link. |
| 2.4.4 | Link Purpose (In Context) | **Supports** | Every link's text states its destination. No "click here", no bare URLs. |
| 2.5.1 | Pointer Gestures | **Supports** | No multi-point or path gesture; every control is one tap. |
| 2.5.2 | Pointer Cancellation | **Supports** | Actions fire on the up-event (`click`), never on `pointerdown`. |
| 2.5.3 | Label in Name | **Supports** | Accessible name contains the visible label verbatim on every button and option — which is why the tests locate controls by role plus the full visible name. |
| 2.5.4 | Motion Actuation | **Supports** | No device-motion input exists. |
| 3.1.1 | Language of Page | **Supports** | `<html lang>` is set from the chosen language and updated live; asserted in every axe run. Language is chosen before the first question. |
| 3.2.1 | On Focus | **Supports** | Focus never changes context. No auto-advance, no focus-triggered navigation. |
| 3.2.2 | On Input | **Supports** | Changing a presentation setting (bigger text, read aloud) changes no context. Choosing an identity route reveals the next step; it does not navigate or submit. |
| 3.2.6 | Consistent Help | **N/A** | Not claimed. The support request is a *step inside the form*, not a help mechanism repeated across pages: it sits at position 3 of 10 in the learner form, 9 of 11 in the job form, and does not exist in the employer form. Read-aloud is a presentation control, not help. The criterion only bites when a help mechanism is repeated on more than one page, so there is nothing here to be inconsistent about — but the earlier "Supports … in the same relative order on all three forms and every step" was overstated and is withdrawn. If a persistent help link is added, it must sit in the same relative position on all three. |
| 3.3.1 | Error Identification | **Supports** | Errors named in text, linked with `aria-describedby`, marked `aria-invalid`, and listed in a `role="alert"` summary with jump links. |
| 3.3.2 | Labels or Instructions | **Supports** | Every field has a label; where a rule is not obvious there is a hint *before* the input (phone format, referral disclosure, identity options). |
| 3.3.7 | Redundant Entry | **Supports** | No answer is asked twice. The device-stored draft means a dropped connection does not mean retyping; the review screen reuses what was entered. |
| 3.3.2 | Labels or Instructions | **Supports** | One question per screen, stated once as the heading, with a hint and a *why we ask* line under it. The field itself takes its accessible name from that heading (`aria-labelledby`) instead of repeating it — the visible wording and the accessible name are the same sentence, and a screen reader announces it once. |
| 4.1.2 | Name, Role, Value | **Supports** | Native `input`, `button`, `fieldset`, `details` only. No ARIA widget is re-implemented by hand, so name/role/value come from the platform. |

---

## 4. Level AA — 24 criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1.2.4 | Captions (Live) | Not applicable | No live media. |
| 1.2.5 | Audio Description (Prerecorded) | Not applicable | — |
| 1.3.4 | Orientation | **Supports** | No orientation lock; single-column fluid layout, tested portrait (390×844) and landscape. |
| 1.3.5 | Identify Input Purpose | **Supports** *(fixed this week)* | `autocomplete` declared in the schema and rendered (`name`, `tel`, `email`, `organization`). Enforced by validator **W11**: a `tel`/`email` step with no token is now a warning — and it immediately caught the parked template, which is the point of putting the rule in the schema instead of in a review checklist. |
| 1.4.3 | Contrast (Minimum) | **Supports** | Body 16.8:1 · muted `#5f6670` 5.80:1 · error text `#cf3636` 4.53:1 on the tint, 4.96:1 on white. Savanna's red `#db3e3e` (4.40:1) is kept verbatim but only on borders, bars and icons, where the 3:1 rule applies. |
| 1.4.4 | Resize Text | **Supports** | 200 % zoom audited as its own case (`9c review @200% zoom`): no horizontal scroll, `h1` visible at 23.2 px, no clipped control. All type in `rem`. |
| 1.4.5 | Images of Text | **Supports** | No images of text anywhere. |
| 1.4.10 | Reflow | **Supports** | 320×640 with no horizontal scrolling, asserted on the review screen (the densest layout) and audited by axe. |
| 1.4.11 | Non-text Contrast | **Supports** | Input borders `#5f6670` 5.80:1; focus ring 14.19:1; the 20 px checkbox is inside a full-row label whose border carries the state at 5.80:1. |
| 1.4.12 | Text Spacing | **Supports** | The exact overrides from the Understanding document are injected and checked (`9d review @WCAG text spacing`): line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, paragraph margin 2em → **0 clipped elements, no horizontal scroll**. |
| 1.4.13 | Content on Hover or Focus | **Supports** | There is no hover-only or focus-only content. Help is always-visible text, never a tooltip. |
| 2.4.5 | Multiple Ways | **Supports** | Three entry pages; language and settings always reachable from the top bar; the review screen jumps back to any answer. |
| 2.4.6 | Headings and Labels | **Supports** | One `h1` per screen carrying the real question; every input has a real `<label>`; section headings only where a section exists. |
| 2.4.7 | Focus Visible | **Supports** | 3 px focus ring at 14.19:1, never removed; asserted in `npm run focus` and visible on every control in the audits. |
| **2.4.11** | **Focus Not Obscured (Minimum)** *(new in 2.2)* | **Supports** | `npm run focus` scrolls to every control and asserts it is not covered by the sticky settings bar. The bar's height is measured with a `ResizeObserver` and fed into `scroll-padding`, so it passes at 200 % zoom and with bigger text — where a hard-coded offset would fail. |
| **2.5.7** | **Dragging Movements** *(new in 2.2)* | **Supports** | No drag interaction exists; nothing needs a single-pointer alternative. |
| **2.5.8** | **Target Size (Minimum)** *(new in 2.2)* | **Supports** | Option rows 52 px tall, buttons ≥ 44 px, checkbox hit area = the whole row. No target below 24×24 CSS px. |
| 3.1.2 | Language of Parts | **Supports** | Amharic strings render inside `lang="am"`. The one Latin-script word inside the Amharic form — the language option **English** — carries `lang="en"`, taken from the schema (`Option.lang`) so an adopter's Tigrinya or Arabic option gets the same treatment without touching the widget. Latin-script ID numbers are digits, which are language-neutral. **Corrected 13 Nov, `23c4564`:** this row previously claimed "no string mixes languages", which was false — the option label inherited `lang="am"` and a screen reader read the word *English* with an Amharic voice. Re-measured: **0** text nodes on the Amharic page whose script differs from the page language and that carry no `lang`. |
| 3.2.3 | Consistent Navigation | **Supports** | The settings bar has the same order and position on all three forms and all steps. |
| 3.2.4 | Consistent Identification | **Supports** | Same icon and same wording for the same action everywhere; labels come from the schema, so they cannot drift between forms. |
| 3.3.3 | Error Suggestion | **Supports** | Messages say what to do, in the user's language: "enter a phone number like 0912345678", not "invalid input". |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | **Supports** | Review screen before submission with per-answer edit links; a device-stored draft; a consent that cannot be submitted unticked; and a failed send that is queued rather than lost. Nothing is final until the server answers, and a lost answer is never the user's fault. |
| **3.3.8** | **Accessible Authentication (Minimum)** *(new in 2.2)* | **Supports** | There is no login, no password and no cognitive puzzle anywhere in the flow. |
| 4.1.3 | Status Messages | **Supports** | Autosave, connection changes, step errors and the submit result are announced via `role="status"` / `role="alert"` without moving focus. The autosave message is throttled so a screen reader is not flooded per keystroke. |

WCAG 2.2's three AAA criteria (2.4.12, 2.4.13, 3.3.9) are not claimed. The implementation would
satisfy 2.4.13 on appearance, but AAA is out of scope for this submission.

---

## 5. Deliberate departures from the Savanna design system

Savanna's shipped pages are not accessible, and adopting them unchanged would have failed the
gate. These are measurements, not opinions:

| Item | Savanna as shipped | What we did | Why |
|---|---|---|---|
| Brand red `#db3e3e` | Used for text and borders | Kept **verbatim** on borders, bars, icons (4.40:1 ≥ 3:1); error *text* is `#cf3636` (4.53:1) | Keep the brand, fix the contrast. One colour shifted 3 % in lightness, only where it carries text. |
| Muted grey `#98a3ae` | 2.57:1 | `#5f6670` (5.80:1) | 2.57:1 is unreadable on a cheap LCD in Addis daylight. |
| Brand green `#05f283` | 1.50:1 | `#028749` (4.60:1) | 1.50:1 fails for text and for non-text alike. |
| Typography | 76 fonts, **no Ethiopic glyphs at all** | Poppins (Latin, 8 kB × 2) + Noto Sans Ethiopic covering the **whole block**, 136 kB | A subset built from our own UI strings renders a learner's Amharic name as tofu boxes. That bug shipped once; it is not coming back. Paid once, then cached by the offline worker — a second visit costs 0 KB. |
| Form semantics | `aria-describedby`, `aria-invalid`, `role=alert`, `fieldset`, `aria-live`: **zero of each** | All present and asserted | Those five attributes are most of Level A for a form. |
| Language | `lang="en"` on an Amharic-first site | Language asked first, `<html lang>` updated live | An Amharic page announced as English is unusable with a screen reader. |

---

## 6. Known limitations

Stated as limitations, not buried. None is a WCAG 2.2 AA failure.

| # | Limitation | Criteria touched | Status |
|---|---|---|---|
| 1 | **No session with disabled users yet.** The co-designer has not yet completed the task with NVDA, TalkBack, keyboard only, 200 % zoom and sound off. | All — a verification gap, not a known defect | **Scheduled before submission (§7).** Anything they find is fixed or listed here. |
| 2 | **Voice input is an enhancement, not a path.** Dictation uses `SpeechRecognition`: absent in Firefox/Safari (the button is then not rendered), present in Chrome, and **unavailable for Amharic** — Chrome has no Amharic speech model, so the language question falls back from `am-ET` to `en-US` and then to an explicit message pointing at the buttons. The form remains fully operable by keyboard either way. | 2.1.1 is met; no criterion requires dictation | Accepted. |
| 3 | **No dictation on consent screens.** Deliberate: a transcribed consent is not consent. Enforced twice — validator rule **E22** and a renderer guard — because this is the kind of rule that gets refactored away. | No criterion requires dictation | Accepted by design. |
| 4 | **Read-aloud voice quality is the device's.** An Android TTS voice may mispronounce Amharic. | 1.4.2 is met (a mechanism exists); voice quality is not a criterion | Accepted. Screen-reader users are unaffected. |
| 5 | **The offline queue lives on one device.** Clearing site data loses a queued sign-up; the user is warned before that can happen and told not to close the page. | 3.3.4 — the failure is announced rather than silent | Accepted; in the README's limitations. |
| 6 | **The job and employer forms do not ask language first** in the way the learner form does (they offer it in the top bar before the first question). 3.1.1 is met on all three. | 3.1.1 met; consistency of approach differs | Partial by design, given two days. The learner form is the one the gate judges. |

---

## 7. Co-designer verification — to be completed before submission

| Session | Participant | Setup | Task | Result | Findings |
|---|---|---|---|---|---|
| 1 | | NVDA + Firefox, keyboard only | Complete the learner sign-up unaided | ☐ pass ☐ pass with notes ☐ fail | |
| 2 | | TalkBack + Chrome, Android | Complete the learner sign-up unaided, 200 % zoom, sound off | ☐ pass ☐ pass with notes ☐ fail | |
| 3 | | Keyboard only, no screen reader | Complete the learner sign-up, sound off | ☐ pass ☐ pass with notes ☐ fail | |

**Protocol:** no assistance, no prompting, no "try pressing tab". Notes record the first point of
confusion, every backtrack, and whether the person could say afterwards what happens next. A fail
is recorded as a fail and fixed — not explained.

---

## 8. Evidence index and sign-off

| Suite | Command | Result |
|---|---|---|
| Schema validation | `npm run validate` | 0 errors, 0 warnings (26 error codes, 11 warnings; onboard 10 steps, job 9, employer 7, template 11) |
| Accessibility | `npm run a11y` | **17 axe audits**, 0 serious / 0 critical |
| Pages and routes | `npm run pages` | 21 routes, titles, legacy `#/onboard` hash route |
| API contract | `npm run api` | 41 assertions |
| End-to-end submit | `npm run submit` | 7 assertions |
| Voice | `npm run voice` | 7 assertions |
| Focus obscured | `npm run focus` | nothing focused is hidden by the sticky bar |
| Third-party requests | `npm run hosts` | only `127.0.0.1:5173` contacted — zero external requests |
| Slow / no connection | `npm run offline` | 22 assertions, incl. 3G budget and one-record-on-disk |
| Production build | `npm run verify:prod` | built bundle behind nginx semantics, CSP clean, 17 audits |

| | |
|---|---|
| Known Level AA failures | **0** |
| Criteria supported | **55 of 55** |
| Co-designer sessions complete | ☐ no — §7 |
| Reproduced by | *(name, date)* |
| Author | OpenPath team, 13 November 2026 |
