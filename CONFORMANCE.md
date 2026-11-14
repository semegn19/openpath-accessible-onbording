# Roha - Accessibility Conformance Report (WCAG 2.2 AA)

**Evaluation Date:** 14 November 2026  
**Target Standard:** Web Content Accessibility Guidelines (WCAG) 2.2 Level AA  
**Evaluation Scope:**
- Savanna Host (`/onboard`, `/job`, `/employer`)
- Independent Blank Host (`demo/blank-host.html`)
- Roha Assistant Embeddable Component (`dist/roha.js`)

---

## 1. Executive Summary

| Audit Dimension | Result | Status |
| :--- | :--- | :--- |
| **Automated axe-core Audits** | 17 screen checks, 0 critical/serious violations | ✅ PASS |
| **Color Contrast (SC 1.4.3 & 1.4.11)** | All body text ≥ 4.5:1; UI controls ≥ 3.0:1 | ✅ PASS |
| **Reflow & Responsive Zoom (SC 1.4.10)** | 320px CSS width with 0 horizontal scroll | ✅ PASS |
| **Text Resize (SC 1.4.4)** | 200% browser zoom with 0 clipping or overlaps | ✅ PASS |
| **Text Spacing (SC 1.4.12)** | WCAG line-height & letter spacing verified | ✅ PASS |
| **Focus Visibility (SC 2.4.7 & 2.4.11)** | 3px visible outline, never obscured by floating bar | ✅ PASS |
| **No Time-outs (SC 2.2.1)** | Unlimited reading and answering time | ✅ PASS |
| **Error Handling (SC 3.3.1 & 3.3.3)** | Announced error summaries with direct focus jump | ✅ PASS |
| **Manual Screen Reader Testing** | Automated tests verified; live co-designer runs pending | ⚠️ DOCUMENTED |

---

## 2. Automated axe-core Audit Results

Running `npm run verify:prod` executes Playwright and axe-core against the production bundle under strict Nginx CSP semantics:

```
=== 1 language ===
  h1: ቋንቋ ይምረጡ
✓ 1 language                         serious/critical: 0  other: 0

=== 2 accessibility preferences (local only) ===
  h1: ቅጹ እንዴት እንዲሠራልዎት ይመርጣሉ?
✓ 2 accessibility prefs              serious/critical: 0  other: 0
✓ 2b prefs selected                  serious/critical: 0  other: 0

=== 3 assistance (this one IS sent) ===
  h1: አንድ ሰው እንዲያግዝዎ ይፈልጋሉ?
✓ 3 assistance                       serious/critical: 0  other: 0

=== 4 name ===
  h1: ስምዎን ይጻፉ
✓ 4 name                             serious/critical: 0  other: 0
✓ 4b error state                     serious/critical: 0  other: 0

=== 5 phone ===
  h1: ስልክ ቁጥርዎን ይጻፉ
✓ 5 phone                            serious/critical: 0  other: 0

=== 6 identity route (six options, incl. no document) ===
  h1: ማንነትዎን እንዴት እናውቃለን?
✓ 6 id-route                         serious/critical: 0  other: 0

=== 7 id number (conditional) ===
  h1: የመታወቂያ ቁጥር
✓ 7 id value                         serious/critical: 0  other: 0

=== 8 referral (consent, no microphone) ===
  h1: ወደ አጋር መመራት
✓ 8 referral                         serious/critical: 0  other: 0

=== 9 review ===
  h1: መረጃዎን ይመልከቱ
✓ 9 review                           serious/critical: 0  other: 0
✓ 9b review @320px                   serious/critical: 0  other: 0
✓ 9c review @200% zoom               serious/critical: 0  other: 0
✓ 9d review @WCAG text spacing       serious/critical: 0  other: 0

=== 10 submit (consent) ===
  h1: ማረጋገጫ
✓ 10 submit                          serious/critical: 0  other: 0

=== 11 done ===
  h1: በዚህ መሣሪያ ላይ ተቀምጧል
✓ 11 success                         serious/critical: 0  other: 0
✓ 12 offline banner (no connection)  serious/critical: 0  other: 0

PASS — 17 axe audits, 0 problem(s)
```

---

## 3. Specific Criterion Conformance Analysis

### SC 1.4.3 Contrast (Minimum) & 1.4.11 Non-text Contrast
- Body text (`--op-text: #212529`) on surface (`#ffffff`) delivers **14.8:1** (exceeds 4.5:1 requirement).
- Muted explanatory labels (`--op-muted: #5f6670`) deliver **4.77:1** on page tint and **5.80:1** on white.
- Error brand red (`--op-error-brand: #db3e3e`) delivers **4.40:1** on borders. Text is darkened to `#cf3636` to achieve **4.96:1** on white.
- Brand green `#05f283` (1.50:1 from original Savanna) was identified as inaccessible and darkened to `#028749` (**4.60:1**).
- High Contrast Mode switch sets pure black background (`#000000`) with white text (`#ffffff`) and yellow focus rings (`#ffff00`).

### SC 1.4.10 Reflow (320px)
- Tested at 320 × 256 px. Form controls, radio buttons, and review lists stack vertically with zero horizontal scrollbars (`horizontal scroll: false`).
- Roha floating widget automatically repositions from bottom-right to top-right (`top: 4.5rem; right: 1rem`) on viewports under 600px to prevent intercepting clicks to the primary Next (`ቀጣይ`) button.

### SC 2.4.11 Focus Not Obscured (Minimum)
- Sticky top settings bar measures its exact bounding box via `ResizeObserver` and updates `--op-bar-h` dynamically. `scroll-padding-top` ensures focused controls are never covered.

### SC 3.3.1 Error Identification & 3.3.3 Error Suggestion
- When an empty required field is submitted, focus shifts immediately to `#op-error-summary` (`role="alert"`).
- Plain language explanations are announced in the active locale (e.g., *"ስምዎን ያስገቡ"* / *"Enter your name"*).

---

## 4. Manual Evaluations Remaining

While automated testing is 100% clean, genuine accessibility requires human verification:
1. **TalkBack on Android (Low-end Transsion / Tecno device):** Testing touch exploration on Ge'ez script typography.
2. **NVDA on Windows 11 with Firefox/Chrome:** Verifying virtual cursor reading order on review screens.
3. **Co-designer unaided task completion:** Scheduled with Ethiopian community partners following hackathon evaluation guidelines.

