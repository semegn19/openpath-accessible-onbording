# Roha Accessibility Evaluation Report

**Evaluation Date:** 14 November 2026 | **Target Standard:** WCAG 2.2 Level AA

## 1. Conformance Evaluation Summary

| Criterion | Implementation Mechanism | Status | Notes |
|---|---|---|---|
| **1.1.1 Non-text Content** | All buttons, icons, and status indicators have programmatic accessible names (`aria-label`, visible text) | PASS | No bare icon-only buttons in Roha panel |
| **1.3.1 Info and Relationships** | Headings, landmarks (`<main>`, `<aside>`, `<form>`), fieldsets, and labels semantically mapped | PASS | Verified in automatic discovery |
| **1.3.2 Meaningful Sequence** | Focus order follows DOM reading order; assistant panel mounted at end of body | PASS | Verified keyboard tab navigation |
| **1.4.3 Contrast (Minimum)** | Default text exceeds 4.5:1 ratio; high-contrast mode exceeds 7:1 ratio (pure black/white/yellow) | PASS | Contrast mode verified |
| **1.4.4 Resize Text** | Built-in 100%–200% text scale factor via `--roha-scale-factor` with no clipped buttons or text truncations | PASS | Verified at 200% zoom |
| **1.4.10 Reflow** | Content reflows vertically down to 320 CSS pixels without 2D scrolling | PASS | Tested with responsive viewport |
| **2.1.1 Keyboard** | All features (mic toggle, stop, scale, contrast, form navigation) operable via Tab/Enter/Space | PASS | Zero pointer-dependent actions |
| **2.1.2 No Keyboard Trap** | Focus moves freely into and out of assistant panel; Esc or Tab cycles predictably | PASS | Verified no focus traps |
| **2.2.1 Timing Adjustable** | Enforced NO form inactivity timer; learner has unlimited time to complete answers | PASS | Requirement O03 fulfilled |
| **2.4.7 Focus Visible** | Distinct 3px solid focus outline with 2px offset visible on all interactive elements | PASS | High-contrast focus styling |
| **3.3.1 Error Identification** | Plain-language error recovery messages announced via live region without technical jargon | PASS | Recoverable error handling |
| **4.1.3 Status Messages** | Live announcements region uses `role="status"` and `aria-live="polite"` | PASS | Does not interrupt screen reader speech |

## 2. Automated axe-core Audit Status

- **Automated axe-core scan:** 17 full axe audits executed across all application screens (`npm run verify:prod`), resulting in **0 critical, 0 serious, and 0 minor issues**.
- Form steps audited: 1 language, 2 accessibility prefs, 2b prefs selected, 3 assistance, 4 name, 4b error state, 5 phone, 6 id-route, 7 id value, 8 referral, 9 review, 9b review @320px reflow, 9c review @200% zoom, 9d review @WCAG SC 1.4.12 text spacing, 10 submit, 11 success, 12 offline banner.
- All three application routes (`/onboard`, `/job`, `/employer`) audited under production CSP: **0 problems**.
- Fonts verified loaded: Poppins 400, Poppins 600, Noto Sans Ethiopic 400 & 700.

## 3. Human & Assistive Technology Verification

- **Keyboard-only:** Full task complete without mouse.
- **Sound-off:** All speech synthesis events mirrored in visible transcript box and polite live region.
- **200% Zoom:** Typography reflows without overlapping controls; min-height 2.75rem maintained for inputs and buttons.
- **Screen Reader (NVDA / TalkBack):** Tested with standard semantic attributes and live regions; field evaluation with independent co-designers is scheduled in accordance with judging criteria. No automated test replaces unaided co-designer completion.
