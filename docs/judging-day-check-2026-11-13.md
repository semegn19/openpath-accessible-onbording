# Judging-day check — your 7 common bugs, your 9-point self-check, and the organisers' actual gate

**Date:** 13 Nov 2026 · **Commit:** `7aa1f3e` · **Engine:** Chromium (Playwright) on `:5173`, plus one schema/code read per row.
**Verdict in one line:** 6 of your 7 bug patterns are absent from this codebase by construction, 1 is genuinely present and is a one-line fix; of your 9 self-checks, 6 pass, 1 passes with a caveat, 1 is documentation and half-done, and 1 cannot be self-certified by anyone on this team.

---

## Part 1 — The seven common bugs

| Bug | Status here | Evidence | If it were a hit, the fix |
|---|---|---|---|
| **Icon button with no name** (4.1.2) | **Absent** | 192 controls across all 29 screens, **0 without a name** in the accessibility tree (measured: `aria-label`, `aria-labelledby`, `<label for>`, wrapping label). Every `<Icon>` in the codebase sits beside a text node (`App.tsx:282,417,484`, `screens.tsx:102–108`, `fields.tsx:211,246,273`) — there is no icon-only control at all, so no `aria-label` rescue is needed anywhere. | Add visible text or `aria-label`. |
| **`<div>` used as a button** (2.1.1, 4.1.2) | **Absent** | `role="button"`: **0 occurrences**. `<div>`/`<span>` with `onClick`: **0** (grep over `src/*.tsx`). Every actionable thing is a native `<button>`, `<a href>`, `<input>` or `<label>`-wrapped input. | Use a real `<button>`. |
| **Placeholder used as a label** (1.3.1, 3.3.2) | **Absent** | Only 3 placeholders in the widget — year / month / day — and each has its own real `<label class="op-sr" htmlFor=…>` (`fields.tsx:177–189`). The placeholder repeats the label, it does not replace it. | Add `<label for>`. |
| **Error not announced** (3.3.1) | **Absent** | Error summary is `role="alert"` with `tabIndex={-1}` (`screens.tsx:16`) **and** focus is moved onto it (`App.tsx:170: if (errorList.length) summary.current?.focus()`). Each field also gets `aria-invalid` + `aria-describedby`. Measured live on all three forms: summary renders, inline text names the field. | `aria-describedby` + move focus to the summary. |
| **Chat replies are silent** (4.1.3) | **N/A, and the equivalent is covered** | There is no chat in this build — Track 1, no assistant. The async replies that do exist (save receipt, offline banner, "a new question was added", voice transcript accepted) all go through **one** region: `role="status" aria-live="polite"` (`App.tsx:411`, plus `292`, `426`, `438`), asserted by `tests/announce.mjs` in the gate. | `role="log"` + `aria-live="polite"` — but that is for a *message history*; `role="status"` is the correct role for these transient messages. Do not add `role="log"` here. |
| **No language set** (3.1.1, 3.1.2) | **Fixed — `23c4564`** | `<html lang="am">` (`index.html`), synced to the chosen language at runtime (`App.tsx:70`), and both chip buttons carry their own `lang` (`screens.tsx:95-96`). The one gap was the option card for English, which rendered `<span class="op-option-label">English</span>` with no `lang`, inheriting `lang="am"`. It now carries `lang="en"` from the schema (`Option.lang`). Re-measured: **0** unmarked other-script runs on the Amharic page. | Diff and acceptance in Part 4. |
| **Focus escapes a pop-up** (2.4.3) | **N/A** | `<dialog>`: **0**. `aria-modal`: **0**. `role="dialog"`: **0**. There are no pop-ups, drawers or modals anywhere in the widget — the settings bar is an inline region, not an overlay, and it never traps focus. | `<dialog>` + `showModal()`. |

### The one real defect, measured

On `/onboard` in Amharic, scanning every text node whose script does not match `document.documentElement.lang` and which has no `lang` on itself or any ancestor:

```
page lang = am  |  Latin-script text runs: 2
  "A"        <text>  — inside an aria-hidden decorative SVG, not exposed to AT  → fine
  "English"  <span class="op-option-label">  lang: NO — inherits am            → the bug
```

Mirror case checked: the English page has **0** unmarked Amharic runs, because the Amharic option is rendered in Latin ("Amharic") there. So the defect is one word, one language direction. A screen reader on the Amharic page will read the English word *English* with an Amharic voice — at the exact moment the person is trying to leave Amharic. That is not cosmetic.

**Correction to what I said in my first pass:** I wrote that no claim existed for this criterion. That was wrong — `docs/wcag-2.2-aa-conformance.md:122` claimed 3.1.2 **Supports** with the words *"no string mixes languages"*, and that sentence was false. The claim is now true, via the fix below, and the row says so explicitly rather than quietly changing.

---

## Part 2 — Your nine-point self-check

| Check | Status | Evidence |
|---|---|---|
| Zero serious or critical in axe | **Pass** | 17 audits in `npm run a11y` (`wcag2a wcag2aa wcag21a wcag21aa wcag22aa`) **plus 26 deeper screens I ran on top** (8 `/onboard`, 10 `/job`, 8 `/employer`): **0 violations of any impact**. Note the shipped suite only audits the screen each URL lands on — the deep screens are mine, not the gate's. |
| Videos have captions and a transcript | **N/A** | There is no video. The only media is recorded read-aloud of each question, and the played text is built from the same copy the screen shows (`App.tsx:378 readAloudText` → `speak`), so the on-screen question *is* the transcript. Audio is also never required — the gate's "sound off" condition costs this form nothing. |
| Works keyboard only; focus always visible | **Pass** | 4 screens × 3 forms: **0** controls outside the tab order, 57 stops, **0** without an outline or box-shadow, 7 radio/checkbox toggles driven by Space, 0 failures. Skip link is the first stop. |
| Page and parts declare their language | **Pass after fix `23c4564`** | Page: `lang="am"` + runtime sync. Chips: `lang="am"` / `lang="en"`. Language option label: was unmarked, now `lang="en"` — re-measured at 0 unmarked runs. |
| Every control has a name in the accessibility tree | **Pass** | 192 controls, 0 unnamed (all 29 screens). |
| Time limits extendable; no login puzzles | **Pass** | No session, no timer, no expiry copy; the only timers are a 10 s *network* abort, two debounces and a speech race cap — none discards input, and failures queue in the outbox rather than expiring. No login, no OTP, no puzzle; Ctrl+V and `insertText` both paste cleanly into fields. |
| NVDA pass on the main user journey | **Not done — cannot be done from here** | No NVDA, no Windows, no screen reader in this environment. Structure is prepared for it (one `<h1>` per screen, groups named by `aria-labelledby`, one polite live region, error summary + focus move) and `README.md:21,76` already flags it as *"needs a human"*. **This is also the organisers' first gate condition — see Part 3.** |
| Content reflows at 400 % zoom | **Pass** | 320 CSS px width (400 % on a 1280 px screen), 12/12 `/onboard` screens, 12/12 `/job`, 11/11 `/employer`: **0 horizontal overflow**, no element wider than the viewport. |
| TalkBack pass inside a mobile WebView | **Not done** | Same reason. Structural prep only. |
| README and API docs describe keyboard and ARIA | **Half** | `README.md` does, thoroughly — a five-gate table (§*The five gate conditions*), a 17-row WCAG table (§*Accessibility*), and an explicit "needs a human" line. `api/openapi.yaml` **does not**: its 6 matches for aria/keyboard/accessibility are incidental (`accessibility-prefs` field names, the event name). One paragraph in the spec's `info.description` would close it. |

---

## Part 3 — The organisers' actual gate

From the event site ([digitalbridge.et](https://digitalbridge.et/), *How modules are judged → First, the gate. Pass or fail.*), verbatim:

> A co-designer completes the main task unaided with NVDA, TalkBack, keyboard only, 200 per cent zoom and sound off. axe-core shows zero critical or serious issues. The team submits a WCAG 2.2 AA conformance report.

Three conditions, pass/fail. Worth saying plainly: **the nine checks you pasted are not the published gate.** They are a study checklist — a good one, and Part 2 answers all of them — but the real gate is narrower and harder, and it is dominated by one thing a team cannot self-certify.

| Gate condition | Status | What actually decides it |
|---|---|---|
| Co-designer completes the main task **unaided**: NVDA, TalkBack, keyboard only, 200 % zoom, sound off | **Unproven** | Only a real co-designer on a real device settles this. What we *can* say: keyboard ✅, 200 % ✅ (measured at 640×400 and 400 %), sound off ✅ (audio is optional everywhere), axe ✅. NVDA/TalkBack behaviour of the single live region — five announcement sources, 15 s save throttle, never-the-first-save rule — is exactly what a screen reader run finds and nothing else does. |
| axe-core: zero critical or serious | **Met** | 43 screens audited (17 in the gate + 26 deep), 0 of any impact. |
| Submit a WCAG 2.2 AA conformance report | **Met** | `docs/wcag-2.2-aa-conformance.md` exists and is strong, and its two overstatements are now corrected: 3.1.2 was false and is fixed in the code (`23c4564`); 3.2.6 claimed a consistency that does not exist across the three forms and is now honestly N/A. It is worth reading the correction notes as evidence of process rather than hiding them. |

One more thing from the site that is not in either of your lists: the training agenda refers to **"WCAG 2.2 AA and the 35 required features"**. That list of 35 is not on the public page and I do not have it — if you have it, send it and I will check the 35 the same way rather than guessing which of them the 16 + 9 above already cover.

---

## Part 4 — The fix, applied as `23c4564`

In `app/src/fields.tsx`, the option label (around line 246) currently renders:

```tsx
<span className="op-option-label">{o.icon && <Icon name={o.icon} />}{optionText(o, lang)}</span>
```

Add a schema-driven `lang` to the wrapper, and one key to the English option in the language step of `schema/savanna-onboard-v1.json`:

```tsx
<span className="op-option-label" lang={o.lang ?? undefined}>{o.icon && <Icon name={o.icon} />}{optionText(o, lang)}</span>
```

```json
{ "value": "en", "label": { "en": "English", "am": "English" }, "lang": "en" }
```

Why the schema and not a hardcoded `lang="en"`: the label is data, and an adopter adding an Arabic or Tigrinya option needs the same affordance without touching the widget. It also matches what the chips already do (`screens.tsx:95-96`).

Acceptance, the same standard as Wave 2a — **all met**:
- `npm run validate` → 0 error(s), 0 warning(s)
- `npm run check` → **EXIT=0, 257 assertions, 0 failures**
- `tests/announce.mjs` → **byte-identical** to the pre-fix run
- the Part 1 scanner re-run → **0** unmarked other-script runs on the Amharic page (was 1)
- radio still findable by the accessible name `English`; `/job` and `/employer` render **0** option labels carrying `lang`

Scope: 1 line of TSX, 1 key in one schema file, 0 CSS, 0 API, 0 copy changes. Nothing else in the flow touches option rendering.

---

## What I could not check

- **NVDA, TalkBack, VoiceOver** — no screen reader in this environment. This is the gate's first condition and remains genuinely open.
- **The 35 required features list** — not published.
- **Firefox/Safari** — Chromium only.
- **Real device at 400 % zoom** — simulated as 320 CSS px in Chromium, which is the standard equivalent for 1.4.10, but is not an Android WebView.
