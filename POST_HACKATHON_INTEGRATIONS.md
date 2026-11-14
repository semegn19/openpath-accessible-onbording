# Post-Hackathon Integration Guide: Deferred P2 Stretch Features

This guide details the **four intentionally deferred P2 stretch features** prepared in the Roha SDK architecture. To protect the core WCAG 2.2 AA accessibility and device-local evaluation budget during the ALX Digital Bridge Hackathon 2026, these integrations run in local mock mode by default and provide modular plug-and-play adapter interfaces.

Each module is fully implemented in `app/src/roha/integrations/` with comprehensive runtime test coverage (86/86 PASS in `app/tests/roha_runtime.spec.mjs`), zero-PII security rules, and tamper-evident audit trails.

---

## 1. Feature B01: Partner-Assisted Portal Adapter

### Overview
Designed for field caseworkers and NGO partner organizations (e.g., **AAAPD** - Federation of Ethiopian Associations of Persons with Disabilities, **LIWAY**, community outreach facilitators) assisting learners who need co-located or telephone assistance to apply.

### Core Privacy & Authority Guarantees
1. **Authenticated Partner Identity**: Partner caseworkers must authenticate via enterprise credentials. Caseworker name, ID, and organization are recorded in the audit trail.
2. **Strict Learner Authority**: The partner can **prepare** answers, but is strictly prohibited from submitting without explicit learner approval (`canSubmitDraft(draft) === false` until learner grants approval).
3. **Bilingual Consent Preview**: Consent is presented in both Amharic and English on the learner's screen before submission.
4. **No Disability Diagnosis Stored**: Medical diagnosis or disability details are never requested, stored, or sent to employers.

### How to Connect Live AAAPD Enterprise Authentication

```typescript
import { RohaSDK, AAAPDOidcProvider } from 'roha-agent';

const roha = new RohaSDK();
const partnerManager = roha.getPartnerManager();

// 1. Configure the AAAPD Enterprise OIDC Provider
const aaapdProvider = new AAAPDOidcProvider({
  issuerUrl: 'https://auth.aaapd-ethiopia.org/oauth2',
  clientId: process.env.AAAPD_CLIENT_ID || 'openpath-roha-client',
  userInfoEndpoint: 'https://auth.aaapd-ethiopia.org/userinfo',
});

partnerManager.setProvider(aaapdProvider);

// 2. Partner logs in using OAuth/OIDC bearer token
await partnerManager.loginPartner(partnerJwtToken);

// 3. Prepare draft application with partner audit info
const draft = partnerManager.prepareDraft('form-job-12', {
  fullName: 'Abebe Bikila',
  phone: '0911223344',
});

// 4. Submit is blocked until learner explicitly grants approval
console.log(partnerManager.canSubmitDraft(draft)); // false

// 5. Learner reviews prepared values on screen and approves
partnerManager.grantLearnerApproval(draft);

console.log(partnerManager.canSubmitDraft(draft)); // true
// Submit can now proceed!
```

---

## 2. Feature B02: SMS Resume Link Gateway

### Overview
Enables learners on low-connectivity connections, feature phones, or shared community devices to receive an SMS resume link to continue their application on another device or when connectivity is restored.

### Core Privacy Guarantees
1. **High-Entropy Opaque Tokens**: The resume URL contains ONLY a 48-character cryptographic token (`?token=4662cc...`).
2. **Strictly Zero PII in URLs**: URLs **never** contain names, phone numbers, answers, or private support needs in query strings.
3. **Bounded TTL & Revocation**: Tokens expire after 48 hours (configurable) and are immediately revoked upon submission or user request.
4. **Transparent Cost Disclosure**: Domestic Ethio Telecom SMS (~0.25 ETB) and Twilio international SMS (~$0.015 USD) cost estimates are surfaced to users.

### How to Connect Ethio Telecom SMS Gateway

```typescript
import { RohaSDK, EthioTelecomSMSProvider } from 'roha-agent';

const roha = new RohaSDK();
const smsService = roha.getSMSService();

// Configure live Ethio Telecom / Telebirr SMS API
const ethioProvider = new EthioTelecomSMSProvider(
  'https://api.ethiotelecom.et/sms/v1/send',
  process.env.ETHIO_TELECOM_API_KEY
);

smsService.setGateway(ethioProvider);

// Dispatch secure resume link
const result = await smsService.createAndSendResumeLink(
  '+251911223344',
  'course-registration-form',
  { preferredName: 'Dawit', currentStep: 3 },
  48 // 48-hour validity
);

console.log(result.resumeUrl); 
// Output: https://openpath.et/resume?token=e1f8... (opaque hex only, zero PII!)
```

### How to Connect Twilio Messaging Gateway

```typescript
import { RohaSDK, TwilioSMSProvider } from 'roha-agent';

const roha = new RohaSDK();
const smsService = roha.getSMSService();

// Configure Twilio SMS provider
const twilioProvider = new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: process.env.TWILIO_PHONE_NUMBER!, // e.g. +1234567890
});

smsService.setGateway(twilioProvider);
```

---

## 3. Feature B03: Private Human Video/Screen Handoff

### Overview
Provides an on-demand, learner-controlled escalation to a live human operator, sign-language interpreter, or community advocate when the automated assistant cannot resolve an obstacle.

### Core Anti-Surveillance Guarantees
1. **Explicit Context Preview**: The learner sees an exact preview of what minimal context will be shared with the operator (e.g., current question name, preferred language, failure reason) **before** initiating contact.
2. **Strict Keyword Exclusion**: National ID / Kebele card numbers, sensitive disability keywords, passwords, and file attachment bytes are automatically stripped from shared context.
3. **Separate Screen-Sharing Opt-In**: Screen sharing is an independent, opt-in consent gate (default `false`). No automated or silent screenshots.
4. **Zero Silent Streaming**: Camera and microphone are strictly unstreamed until the learner explicitly accepts the call.

### How to Connect Live WebRTC / Call Center

```typescript
import { RohaSDK, WebRTCCallCenterProvider } from 'roha-agent';

const roha = new RohaSDK();
const handoffManager = roha.getHumanHandoffManager();

// Configure live WebRTC signaling server
const callCenterProvider = new WebRTCCallCenterProvider({
  signalingUrl: 'https://support.openpath.et/signaling',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

handoffManager.setProvider(callCenterProvider);

// 1. Generate minimal context preview
const preview = handoffManager.generateContextPreview(
  'Document Upload Step',
  'am',
  currentFormAnswers,
  'Camera failed to capture ID card',
  false // screen-sharing disabled by default
);

// 2. Submit support request after learner reviews and confirms preview
const ticket = await handoffManager.submitSupportRequest(
  'video-sign-language',
  '+251911223344',
  preview
);

console.log(`Support ticket ${ticket.ticketId} queued. Estimated wait: ${ticket.waitTime} minutes.`);
```

---

## 4. Feature V03: Always-On Background Wake-Word Detector

### Overview
In the foreground, tap, button, and keyboard activation are primary and active.
The background wake-word detector ("Hey Roha" / "ሄይ ሮሃ") across locked mobile screens or dormant background tabs is scheduled post-hackathon when a custom trained on-device TensorFlow Lite / ONNX keyword spotter model is deployed.

### Honest Capability Declaration
- In capabilities metadata (`caps.languages[...].capabilities.wake`), `status` is honestly marked `'unavailable'` and `offlineReady: false` during the hackathon evaluation.
- When an on-device model checkpoint is provided post-hackathon, the pluggable manager dynamically updates its capability declaration without requiring core code changes.

### How to Connect Custom TensorFlow Lite Keyword Spotter

```typescript
import { RohaSDK, TFLiteWakeDetector } from 'roha-agent';

const roha = new RohaSDK();
const wakeManager = roha.getWakeWordManager();

// 1. Configure the on-device TFLite model detector
const tfliteDetector = new TFLiteWakeDetector({
  modelPath: '/models/hey_roha_quantized_v1.tflite',
  threshold: 0.88,        // 88% confidence threshold
  sampleRate: 16000,      // 16kHz audio input
  cooldownMs: 2500,       // 2.5s debounce between triggers
  keywords: ['Hey Roha', 'ሄይ ሮሃ'],
});

// 2. Initialize and attach to Roha
await tfliteDetector.init();
roha.attachWakeWordDetector(tfliteDetector);

// 3. Enable wake detection
await wakeManager.enable();

// When "Hey Roha" is detected by the AudioWorklet model,
// Roha automatically starts listening for the user's command!
```

---

## 5. Summary Matrix of Prepared Integrations

| Feature ID | Feature Name | Primary Provider | Fallback / Mock Mode | Privacy & Safety Contract |
|---|---|---|---|---|
| **B01** | Partner-assisted portal | `AAAPDOidcProvider` (OIDC/OAuth2) | Local mock facilitator | Learner review required; submission locked until learner approves; full audit trail |
| **B02** | SMS resume link | `EthioTelecomSMSProvider` & `TwilioSMSProvider` | Local simulation logger | Opaque 48-char tokens; strictly zero PII in query string; 48h TTL; instant revocation |
| **B03** | Private human handoff | `WebRTCCallCenterProvider` & `RestCallCenterProvider` | Local queue simulator | Pre-flight context preview; sensitive keyword filter; screen sharing independent opt-in |
| **B04** | Pluggable wake word | `TFLiteWakeDetector` & `WebSpeechWakeDetector` | `MockWakeWordDetector` & foreground button tap | Honest `'unavailable'` capability flag; 2000ms cooldown; zero background audio streaming without consent |

All integration adapters are bundled in `dist/roha.js` (61.8 KB raw, 18.1 KB gzipped, well within the 150 KB budget) and exported under `RohaBundle` / `window.Roha`.
