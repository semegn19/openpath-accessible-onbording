# OpenPath Integration Level 1 — Embed Contract & Loader Specification

**Status:** Built and verified (`app/public/embed.js`, `app/tests/embed.mjs`).  
**Protocol Version:** `v: 1`

---

## 1. Overview

Integration Level 1 allows any host website (e.g., Savanna portal, an employer intranet, or a university LMS) to drop in an accessible OpenPath onboarding, job application, or accommodation form with **one script tag**.

The form runs inside an isolated, responsive `<iframe>` with:
- Zero cross-site style contamination.
- Automated height synchronization (no inner scrollbars).
- Microphone permission delegation for voice input.
- Accessible name labeling for screen reader users (WCAG 4.1.2).
- Bi-directional `postMessage` communication with the host page.

---

## 2. Drop-in Integration (HTML)

```html
<!-- 1. Provide an optional container element -->
<div id="openpath-container"></div>

<!-- 2. Drop in the loader script -->
<script src="https://openpath.example.et/embed.js"
        data-form="onboard"
        data-lang="am"
        data-target="#openpath-container"
        data-title="የተማሪ ምዝገባ ቅጽ">
</script>
```

### Script Tag Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `src` | string | *required* | URL to `embed.js`. The host origin is automatically inferred from this URL. |
| `data-form` | string | `"onboard"` | Form to display: `"onboard"` (Learner), `"job"` (Job application), or `"employer"` (Accommodations). |
| `data-lang` | string | `"am"` | Initial language: `"am"` (Amharic) or `"en"` (English). |
| `data-target` | string | *none* | CSS selector of the container element. If omitted, the iframe is inserted right before the `<script>` tag. |
| `data-title` | string | localized default | Accessible `title` attribute for the iframe (WCAG 4.1.2). |
| `data-origin` | string | inferred | Explicit base URL of the OpenPath server if loading through a third-party proxy or CDN. |

---

## 3. Programmatic JavaScript API

Integrators who use React, Vue, Angular, or single-page frameworks can initialize OpenPath programmatically:

```javascript
import 'https://openpath.example.et/embed.js';

const instance = window.OpenPath.init({
  form: 'onboard',                       // 'onboard' | 'job' | 'employer'
  lang: 'am',                            // 'am' | 'en'
  target: document.getElementById('signup'),
  title: 'የተማሪ ምዝገባ ቅጽ',
  onEvent: (event) => {
    if (event.type === 'submitted') {
      console.log('Submission received:', event.id, event.reference);
    }
  }
});

// To change language dynamically from the host:
instance.postToWidget({ type: 'set-lang', lang: 'en' });

// To clean up on unmount:
instance.destroy();
```

---

## 4. `postMessage` Communication Protocol (`v: 1`)

All messages between the OpenPath iframe and the host use JSON payloads with `source: 'openpath'` (outbound) or `source: 'openpath-host'` (inbound) and `v: 1`.

### 4.1 Outbound Events (Iframe → Host Page)

The loader script automatically listens for these messages and re-dispatches them as DOM events on both the `<iframe>` element and `window` (`openpath:ready`, `openpath:resize`, `openpath:step`, `openpath:submitted`).

#### `ready`
Sent when the form has initialized and mounted.
```json
{
  "source": "openpath",
  "v": 1,
  "type": "ready",
  "formId": "savanna-onboard-v1",
  "lang": "am"
}
```

#### `resize`
Sent on every step change, validation error expansion, or settings toggle to sync iframe height. `embed.js` automatically applies this height so the embed never displays nested scrollbars.
```json
{
  "source": "openpath",
  "v": 1,
  "type": "resize",
  "height": 740
}
```

#### `step`
Sent whenever the user advances or navigates back between steps.
```json
{
  "source": "openpath",
  "v": 1,
  "type": "step",
  "formId": "savanna-onboard-v1",
  "stepId": "accessibility-prefs",
  "index": 1,
  "total": 9
}
```

#### `submitted`
Sent when the form has been successfully saved to the outbox and transmitted to the API.
```json
{
  "source": "openpath",
  "v": 1,
  "type": "submitted",
  "formId": "savanna-onboard-v1",
  "id": "sub_XIRhqpj85IJyl3nM",
  "reference": "ref_mwg6u7lp8w99eigt"
}
```

#### `queued`
Sent when the submission has been safely written to local storage / outbox because the device or network is currently offline.
```json
{
  "source": "openpath",
  "v": 1,
  "type": "queued",
  "formId": "savanna-onboard-v1",
  "reference": "ref_mwg6u7lp8w99eigt",
  "reason": "offline"
}
```

---

### 4.2 Inbound Commands (Host Page → Iframe)

The host can send commands to the widget:

#### Switch Language (`set-lang`)
```javascript
iframe.contentWindow.postMessage({
  source: 'openpath-host',
  v: 1,
  type: 'set-lang',
  lang: 'en'
}, '*');
```

#### Apply Settings (`set-settings`)
```javascript
iframe.contentWindow.postMessage({
  source: 'openpath-host',
  v: 1,
  type: 'set-settings',
  settings: {
    simple: true,
    big: true
  }
}, '*');
```

---

## 5. Security & Accessibility Considerations

1. **Permissions Delegation (Microphone)**:
   The iframe is created with `allow="microphone"`. This delegates audio recording permissions from the host to the widget so Amharic voice dictation works seamlessly inside the host.
2. **CSP Framing**:
   Production `nginx.conf` sets `Content-Security-Policy: ... frame-ancestors *;`. This allows any authorized adopter domain to frame the widget without security warnings.
3. **WCAG 2.2 Conformance in Embeds**:
   - **SC 4.1.2 Name, Role, Value**: The iframe always has an accessible non-empty `title` attribute.
   - **SC 2.4.3 Focus Order**: Focus cleanly enters the top of the form and exits without keyboard traps.
   - **SC 1.4.10 Reflow**: The iframe width is 100%, reflowing down to 320px with zero horizontal scrolling.
   - **SC 2.4.11 Focus Not Obscured**: Auto-resizing avoids inner iframe scrollbars, ensuring focused inputs are always fully visible.
