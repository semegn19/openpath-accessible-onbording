# Savanna theme → OpenPath tokens: contrast audit

Measured **13 November 2026** from `alx-africa/Savanna-static-pages` (shallow clone, `assets/css/application_alx.css` + `app.css`). WCAG 2.x relative-luminance formula, computed not estimated. Re-verify if Savanna publishes updated brand tokens.

## 1. What the host actually is

| Property | Finding | Consequence for OpenPath |
|---|---|---|
| Stack | **Ruby on Rails (Sprockets) + Bootstrap 5 + React islands + Font Awesome + VideoJS + DHTMLX scheduler** | Global CSS is 1.5 MB and aggressively global. `.op-root` scoping and `@layer openpath` are not optional niceties — they are the only thing preventing our controls from inheriting Bootstrap geometry |
| Brand tokens exist as CSS custom properties | `--savanna-aice-{primary,secondary,accent,tertiary,light}[-40/-60/-80/-hover]` | Map these to `--op-*` rather than inventing a palette |
| Body font | `--bs-font-sans-serif: "Poppins", sans-serif`; also loads Lexend, DM Sans, Inter, plus Typekit | Adopt Poppins for standard mode; **offer Lexend in reading-assistance mode** (already in their bundle, and more legible than Poppins) |
| **Ethiopic coverage** | **No Ethiopic font anywhere** in 76 font files; zero Ethiopic characters in the pages; `<html lang="en">` only | Our Amharic UI would be the **first** Ethiopic text in Savanna. Font fallback, line-height and visual QA are real work, not a tail task |
| Form accessibility machinery present | 12 `<input>`, 10 `<label>`, but **0** `aria-describedby`, **0** `aria-invalid`, **0** `role="alert"`, **0** `<fieldset>`, **0** `aria-live` | Evidence for the baseline argument. (Caveat: these are dashboards, not the registration form — measure the real form before quoting it) |
| Host JS writes inline styles (`body.sidebar-collapsed`, `display` per element) | Our CSS must tolerate a host that mutates styles and classes underneath us |

## 2. Contrast results (against `#ffffff`)

| Token | Hex | Ratio | Normal-text AA (4.5) | White text on it (4.5) | Use it for |
|---|---|---|---|---|---|
| `primary` (navy) | `#002b56` | **14.19** | ✅ | ✅ | Primary buttons, headings, **focus ring** |
| `primary-hover` | `#335578` | **7.75** | ✅ | ✅ | Hover/active states |
| `accent` (purple) | `#5648b7` | **6.99** | ✅ | ✅ | Secondary actions, links, focus ring |
| `link` blue | `#2275d7` | **4.57** | ✅ (barely) | ✅ | Links — do not lighten |
| `body text` | `#212529` | **15.43** | ✅ | ✅ | Default text |
| **`brand red`** | `#db3e3e` | **4.40** | ❌ **fails by 0.10** | ❌ | Icons/borders only (≥3:1) — **not error text** |
| **`secondary` (green)** | `#05f283` | **1.50** | ❌ | ❌ | Decorative fills only. Never text, never a focus ring |
| **`tertiary` (blue)** | `#67bbdf` | **2.15** | ❌ | ❌ | Decorative only |
| **`muted grey`** | `#98a3ae` | **2.57** | ❌ | ❌ | Nowhere near text. Use the variant below |
| `light-bg` | `#e7e9ec` | 1.22 | — | — | Surface only; **not** a border (needs 3:1) |

**Focus ring:** never the brand green (`1.50:1` — invisible to the users who need it most). Use navy `#002b56` (14.19) on light surfaces, or accent purple `#5648b7` (6.99) where navy would clash with a navy button.

## 3. Accessible variants to define in `themes/savanna.css`

Darkened only as far as necessary, so brand recognisability survives:

| Purpose | Source | Accessible variant | New ratio |
|---|---|---|---|
| Error text | `#db3e3e` | `#d83d3d` | 4.51 ✅ |
| Muted/secondary text | `#98a3ae` | `#6e767f` | 4.60 ✅ |
| Muted border / icon | `#98a3ae` | `#8b95a0` | 3.04 ✅ |
| Success text | `#05f283` | `#028749` | 4.60 ✅ |
| Success border | `#05f283` | `#03ab5d` | 3.01 ✅ |
| Info text | `#67bbdf` | `#457d95` | 4.54 ✅ |
| Info border | `#67bbdf` | `#569dbb` | 3.03 ✅ |

Every one of these must appear in `tokens.pairs.json` so the build fails if someone "restores brand fidelity" later.

## 4. Token mapping to implement

```css
/* packages/react/src/styles/themes/savanna.css — loaded INSIDE @layer openpath.tokens */
:where(.op-root)[data-op-theme="savanna"] {
  --op-color-text:            #212529;
  --op-color-text-muted:      #6e767f;   /* was #98a3ae — 2.57:1, unusable */
  --op-color-surface:         #ffffff;
  --op-color-surface-alt:     #e7e9ec;
  --op-color-border:          #6e767f;   /* needs 3:1 against surface, not 1.22 */
  --op-color-border-strong:   #002b56;
  --op-color-primary:         #002b56;
  --op-color-primary-hover:   #335578;
  --op-color-on-primary:      #ffffff;
  --op-color-accent:          #5648b7;
  --op-color-link:            #2275d7;
  --op-color-focus:           #002b56;   /* NOT #05f283 (1.50:1) */
  --op-color-error-text:      #d83d3d;   /* NOT #db3e3e (4.40:1) */
  --op-color-error-border:    #db3e3e;
  --op-color-error-surface:   #fdf2f2;
  --op-color-success-text:    #028749;
  --op-color-warning-surface: #fff8e1;
  --op-font-sans: "Poppins", "Noto Sans Ethiopic", system-ui, -apple-system, "Segoe UI", sans-serif;
  --op-font-reading: "Lexend", "Noto Sans Ethiopic", Verdana, sans-serif;  /* reading-assistance mode */
  --op-line-height: 1.65;                 /* Ge'ez ascenders/descenders need this */
}
```

## 5. Ethiopic typography gap (must be handled explicitly)

Poppins, Lexend, DM Sans and Inter **contain no Ethiopic glyphs**. Without action, Amharic renders in whatever the device falls back to — inconsistent metrics, possible clipped ascenders, and a visual mismatch with the rest of Savanna.

Required work (P2, tracked here so it is not discovered late):

1. Ship a **subsetted Noto Sans Ethiopic WOFF2** (OFL licence; subset to the Ge'ez block + Latin digits).
2. Put it after the Latin family in the stack so Latin stays Poppins and Ge'ez resolves locally — verify on Android 8 WebView **and** Android 13.
3. Set `line-height: 1.65` minimum and test 400% zoom for clipped ascenders/descenders on ጵ ጽ ፈ ጸ.
4. Visually review Poppins + Noto Sans Ethiopic side by side — different x-heights and stroke weights need a designer's eye, not a contrast test.
5. Never italicise Ge'ez (Savanna's CSS uses italics in places — our `.op-root` must neutralise it inside form content).

## 6. What to adopt, override, and refuse

| Adopt | Override | Refuse |
|---|---|---|
| Navy/white/accent palette and the token *names* | Muted grey, brand red, brand green, tertiary blue (for text/UI) | The brand green as a focus indicator |
| Poppins for standard mode; Lexend for reading mode | Focus ring colour | Bootstrap's form-control geometry inside `.op-root` |
| Border radii and spacing rhythm | Any `!important`-based theming | Their 1.5 MB global CSS on our side — we ship ≤ 22 KB |
| Their error-red for borders/icons | Their italic usage in form copy | Font Awesome icon-only controls (we need text labels) |
