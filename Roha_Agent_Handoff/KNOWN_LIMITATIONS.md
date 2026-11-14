# Roha Known Limitations & Technical Boundaries

In accordance with SPEC.md and hackathon integrity rules, all boundaries and unverified capabilities are explicitly documented.

## 1. Document & Control Boundaries

- **Closed Shadow DOM:** Elements encapsulated inside `mode: "closed"` shadow roots cannot be discovered via standard DOM queries. A plain fallback message is reported to the host engineer.
- **Cross-Origin iframes:** Browser cross-origin security policies (SOP) strictly prevent DOM inspection or script access into third-party iframes.
- **Canvas / WebGL:** Canvas-rendered text or controls contain no semantic DOM nodes and are reported as unsupported.
- **Unlabelled Custom Controls:** Controls lacking visible labels, `aria-label`, or accessible names cannot be reliably operated without host overrides.

## 2. Voice & Wake Boundaries

- **Wake Word ("Hey Roha"):** No dedicated, lightweight, permissively licensed wake detector exists out of the box for "Hey Roha". While foreground detection is prepared, always-on background wake across locked screens is unavailable in standard web browsers without native app extensions. Tap and keyboard enablement remain the authoritative entry points.
- **Tigrinya (`ti`) and Afaan Oromo (`om`):** While UI strings and command tables are structured, arbitrary speech-to-text (ASR) is unavailable in standard Whisper. These languages are honestly marked as `unavailable` for ASR in the capability matrix.
- **Microphone Permissions:** Web browsers strictly require an explicit user gesture (click/tap) before granting microphone access. Spoken commands cannot bypass browser-enforced security boundaries.

## 3. Offline & Service Worker Boundaries

- **Host-Origin Scope:** A client script loaded from another origin cannot register a service worker on the host's domain. Full offline caching of the host requires the host site to register the provided `sw.js` under its own origin.
- **Host Session Expiry:** Roha preserves learner drafts locally across network loss, but cannot extend expired host authentication tokens or backend server sessions.

## 4. Integration Boundaries

- **Demonstration Vacancies:** Vacancies displayed on sample hosts are mock fixtures for evaluation and are labelled as samples.
- **Savanna Adapter:** The Savanna integration boundary is defined via clean interfaces; live integration with production Savanna backend is unverified until host credentials and starter endpoints are deployed.

## 5. Post-Hackathon Prepared Integrations (P2 Stretch)

The following four features are intentionally prepared as modular pluggable adapters rather than live dependencies, in order to protect the core evaluation budget and respect hackathon integrity guidelines:

- **B01 Partner-assisted portal:** Fully structured in `app/src/roha/integrations/partner-portal.ts` with `AAAPDOidcProvider`, bilingual consent (Amharic & English), and tamper-evident audit trail. Requires live enterprise authentication agreement before production deployment (never implies a formal AAAPD partnership without executed agreements).
- **B02 SMS resume link:** Fully structured in `app/src/roha/integrations/sms-gateway.ts` with `EthioTelecomSMSProvider`, `TwilioSMSProvider`, high-entropy opaque tokens, and zero PII in query strings. Requires a paid telecom SMS gateway subscription in production.
- **B03 Private human video/screen handoff:** Fully structured in `app/src/roha/integrations/human-handoff.ts` with `WebRTCCallCenterProvider`, `RestCallCenterProvider`, strict context preview allowlists (omits IDs, passwords, sensitive disability details), and an independent screen-sharing opt-in gate. Requires an active live operator helpdesk center in production.
- **V03 Always-on background wake word:** Fully structured in `app/src/roha/integrations/wake-detector.ts` with `TFLiteWakeDetector` and `WebSpeechWakeDetector`. In standard browsers, foreground tap/keyboard activation is primary; custom trained on-device keyword models across locked screens or dormant tabs are scheduled for post-hackathon deployment.

Complete drop-in connection code and credentials configuration are documented in `POST_HACKATHON_INTEGRATIONS.md`.
