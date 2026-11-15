# Roha - product and engineering specification

Version 2.0 | 14 November 2026 | Prepared from the supplied build prompt

This document specifies the target product. It is not evidence that these features are implemented. Keep the source requirements, this feature catalog, task plan and test evidence together. Never silently remove a requested feature to fit the hackathon; move optional work to a named later phase and explain the scope.

## Product promise

A website owner installs one Roha script. Roha discovers the current page automatically, builds a JSON map and helps a learner use that website by voice, text, keyboard or touch. The learner can ask for larger text, simpler explanations, reading, navigation, form filling and correction. A manually authored site map is optional. Roha is assistance with website interaction, not a claim that an overlay repairs every WCAG issue.

Use Roha in every visible brand name and example. Proposed phrase: Hey Roha. The name becomes a real activation feature only when a working recogniser/detector is trained or configured and tested. First enablement requires a user gesture and microphone permission. Foreground wake is the first target; always-on background wake across every phone is a later platform-specific goal.

## Users and complete journeys

1. A blind learner explores a previously unseen host, asks where they are, hears a question, answers, corrects a number and reviews before sharing.
2. A learner with a physical disability completes the same journey with voice or keyboard and learner-controlled document selection.
3. A learner who reads with difficulty asks for simple explanations and larger text without losing the original meaning.
4. A learner without national ID chooses a host-supported refugee-ID, other-document or referral route.
5. A job seeker filters by explicitly requested support privately, applies through the shared engine, and keeps support needs separate from the employer application.
6. An employer declares accommodations and a private request route. A configured partner may assist only with learner consent.

## Scope and priorities

- P0: main journey, required Track 1/career behaviour, automatic reuse, core privacy and an explicitly declared offline profile. Reserve the last three hours for evaluation and fixes.
- P1: high-value improvements when the main journey is stable; particularly correction, orientation, recoverability and adoption evidence.
- P2: bonus and platform expansion after the required accessibility gate.

The four-language and five-OS goals remain in the product scope. Do not equate an interface for a language with verified dictation, arbitrary TTS or wake recognition. The hackathon release must state exactly which profiles are actually demonstrated. Use SOURCE_REQUIREMENTS.txt as the original brief, FEATURES.json as the machine-readable catalog and this document for interpretation. If a source instruction is ambiguous, preserve the learner's control and record the assumption.

## Judging and evidence

The supplied scoring is 30% works for intended users, 25% adoption, and 15% each for Ethiopia, quality/privacy and sustainability. The gate requires unaided co-designer task completion, NVDA, TalkBack, keyboard only, 200% zoom, sound off, zero critical/serious axe issues and a WCAG 2.2 AA evaluation. Automated results alone do not establish conformance. Never invent co-designer feedback, a partnership, an installed language capability or a passed test.

The 21 October findings and the Savanna starter must be used when actually provided. If absent, record that limitation rather than fabricating their contents.

## Feature catalog and measurable acceptance

### Understand a new website

**D01 [P0] Automatic page discovery**

Discover visible headings, landmarks, forms, inputs, choices, buttons, links, menus, searches, tables, documents and job cards from semantic HTML. Exclude Roha UI.

Acceptance (AT-D01): A new labelled fixture is understood without a supplied site schema.

**D02 [P0] Accessible names and ambiguity**

Resolve labels, aria-labelledby, aria-label and semantic text. Use surrounding section/form context to distinguish repeated names.

Acceptance (AT-D02): Two Apply buttons in different job cards are identified by job context; an ambiguous request asks which one.

**D03 [P0] Generated JSON map and live registry**

Generate versioned public page metadata with session IDs. Keep actual DOM handles in a separate local registry; exclude raw HTML, selectors and entered field values from the map.

Acceptance (AT-D03): Schema-valid map references current targets; stale or invented target IDs cannot execute.

**D04 [P0] Dynamic pages and navigation**

Observe relevant DOM/route/menu changes with debouncing, scoped rescans and cancellation. Do not steal focus.

Acceptance (AT-D04): A dynamically added labelled field appears once; removed fields cannot receive later proposals.

**D05 [P0] Optional host overrides**

Expose trusted metadata/handler overrides for difficult controls, privacy classification, page caching and authorised submission. Basic discovery remains automatic.

Acceptance (AT-D05): One script works on two ordinary hosts; an override improves a custom control without changing the core.

**D06 [P0] Honest unsupported-control handling**

Identify unlabelled or unsupported controls, closed shadow roots, inaccessible documents, cross-origin frames and canvas boundaries.

Acceptance (AT-D06): Roha gives a plain fallback or asks the host for support; it never invents a successful interaction.

**D07 [P1] Website compatibility report**

Provide a developer-only report of discovered tasks, ambiguous/unlabelled controls and missing adapters. Do not expose private field values or present it as a WCAG certification.

Acceptance (AT-D07): A host engineer can see actionable integration gaps without learner data.

### Converse and recover

**V01 [P0] Enable voice and visible permission state**

Use an accessible user-initiated microphone permission flow, processing notice, listening/speaking states and a persistent Stop control.

Acceptance (AT-V01): Denied permission leaves a usable keyboard/text flow with no answer loss.

**V02 [P0] Natural turn-taking**

After permission, alternate listening and speaking without a click per question. Prevent echo/self-transcription. Keep a transcript and text controls.

Acceptance (AT-V02): One real recorded conversation fills several answers without microphone clicks between fields.

**V03 [P1] Foreground name activation**

Use the proposed phrase Hey Roha only after explicit enablement and actual testing. Always provide tap/keyboard activation.

Acceptance (AT-V03): Activation works in the documented foreground/device profile; unavailable wake support is labelled.

**V04 [P0] Conversation state and answer correction**

Track current task/question, proposed value, accepted value and navigation state. Allow change, cancel, back and final review.

Acceptance (AT-V04): A deliberately misheard answer is corrected and the right value remains after back/next navigation.

**V05 [P0] Voice navigation and recovery**

Support read, repeat, slower, stop speaking, pause, continue, back, next, explain, review and correction.

Acceptance (AT-V05): Core intents work through a local command router even when the LLM is disabled; text alternatives work.

**V06 [P0] No invented user information**

Learn the preferred name from the learner or permitted profile context; use only relevant session information.

Acceptance (AT-V06): Roha asks an unknown name and never fabricates contact, identity, qualification or eligibility details.

**V07 [P1] Spelling and number verification**

Offer optional spell-it mode for names/email and digit-by-digit phone review. Distinguish spoken words from navigation commands in dictation.

Acceptance (AT-V07): A mixed spelling/number example can be corrected without unintended Next or Submit actions.

**V08 [P1] Interruption and resume recap**

Pause safely; let the learner stop speech immediately and request a short recap on resume. Full-duplex voice interruption is optional and must be tested.

Acceptance (AT-V08): Stopping does not discard accepted answers; resume states the current task without exposing private details aloud.

### Change the real interface

**A01 [P0] Real text scaling and reset**

Apply reversible text/control scaling to supported host content; respect existing zoom and prevent clipped actions.

Acceptance (AT-A01): Voice or text enlarges actual host content, reset works, and 200% zoom remains usable.

**A02 [P0] Simple explanation with original available**

Use reviewed short explanations first; an optional local LLM can explain selected content without changing original wording or meaning.

Acceptance (AT-A02): The simpler question preserves consent/eligibility choices and the original remains available.

**A03 [P0] Read-aloud and page navigation**

Read selected content, question, choices and headings; move to named sections/links using the live registry.

Acceptance (AT-A03): The correct content is read or focused, and Stop always works.

**A04 [P1] Contrast, motion and calm view**

Offer high contrast, reduced motion and a reversible calmer presentation that preserves content and native semantics.

Acceptance (AT-A04): Settings do not remove instructions, status meaning or controls; reset restores the host view.

**A05 [P0] Keyboard, screen reader and sound-off parity**

Use clear labels, logical focus, visible focus, useful status announcements, no traps, non-obscuring controls and text equivalents.

Acceptance (AT-A05): The complete primary task is testable with keyboard, NVDA, TalkBack, sound off and 200% zoom.

**A06 [P1] Orientation: where am I?**

Give a short page overview, current section and available tasks using discovered content.

Acceptance (AT-A06): Roha explains the actual page and offers only actions currently present.

**A07 [P1] Preview and undo local changes**

Show/read what Roha proposes; undo reversible preferences and unsubmitted field edits. Never imply an external submission was undone.

Acceptance (AT-A07): An accidental local change is reverted; completed external writes are clearly distinguished.

**A08 [P2] Optional reading focus and spacing**

Add an opt-in reading ruler or spacing preference only if it does not interfere with selection, screen readers or reflow.

Acceptance (AT-A08): The enhancement is reversible and passes the same keyboard/zoom checks as the default view.

### All required Track 1 onboarding

**O01 [P0] Sign-up and profile engine**

Guide one question per screen with clear labels, native inputs, plain validation and profile editing. Synchronise approved values with the original form.

Acceptance (AT-O01): The learner completes and edits a profile without duplicate IDs or conflicting controls.

**O02 [P0] Voice answers, review and edit**

Support appropriate text/choice fields by voice and provide correction and final review. Respect host constraints and server validation.

Acceptance (AT-O02): A learner can reject or edit any recognised answer before sharing.

**O03 [P0] No form inactivity timer**

Do not expire active questions or clear drafts because of silence. Explain a host session expiry and preserve permitted progress.

Acceptance (AT-O03): After an idle period, the task remains recoverable; Roha does not claim it can extend host authentication.

**O04 [P0] Low-literacy route**

Use short words, text-labelled icons, numbered choices, read-aloud questions and visible progress without inventing a total step count.

Acceptance (AT-O04): The low-literacy route reaches review with text/sound-off alternatives.

**O05 [P0] Alternative ID routes**

Allow refugee ID, other documents or partner referral where the host permits them. Explain each route plainly.

Acceptance (AT-O05): A learner without national/kebele ID or passport reaches review without a forced national-ID upload.

**O06 [P0] Private support without medical proof**

Keep support requests separate from the public application and require no diagnosis, medical proof or disability label.

Acceptance (AT-O06): Support content is absent from employer/public exports, generic completion events and telemetry.

**O07 [P0] Learner-controlled attachments**

Explain file type/size, focus the native picker, announce selected filenames and handle cancellation/error. Recheck uploads server-side.

Acceptance (AT-O07): The learner chooses a document; Roha neither scans folders nor pretends voice bypasses browser/OS permission.

**O08 [P0] Consent, review and truthful submission**

Summarise public answers separately from private support; obtain explicit final approval; distinguish prepared, pending, received and failed.

Acceptance (AT-O08): No submission occurs before approval; success requires a real host receipt.

**O09 [P0] Minimal save/resume and deletion**

Use explicit trusted-device consent for permitted draft fields, portable export and deletion. Exclude private support, document bytes and identity details by default.

Acceptance (AT-O09): A recovered draft explains omitted fields and does not include sensitive/private data.

### Required career gateway

**C01 [P0] Conversational job application**

Reuse the same guided engine for job answers, optional CV selection, correction and final review.

Acceptance (AT-C01): A sample job application reaches review through the same reusable SDK.

**C02 [P0] Private support-needs job filter**

Filter using explicitly selected needs and employer-declared accommodations. Keep preferences out of application payloads and request logs by default.

Acceptance (AT-C02): A supported filter changes matching examples locally without disability inference or disclosure.

**C03 [P0] Employer accommodations form**

Collect what support the employer offers and a private way to request it; do not require candidates to disclose a diagnosis.

Acceptance (AT-C03): An employer listing supplies meaningful declared accommodations for filtering.

**C04 [P1] Job context and application checklist**

Read/explain the selected job and show missing application items based on its declared requirements.

Acceptance (AT-C04): Roha does not invent a live vacancy, requirement, employer promise or completed application.

### Offline and efficient operation

**F01 [P0] Host-origin offline cache**

Cache the core, approved public host routes/content and selected packs with versioned service-worker rules. Never cache private API responses by default.

Acceptance (AT-F01): After installation, the declared offline journey survives an internet-disconnected reload.

**F02 [P0] Explicit runtime profiles**

Separate device-local, local-network hub and optional remote operation. Use appropriate trusted transport and per-profile capability checks.

Acceptance (AT-F02): The UI honestly states whether internet, LAN or installed local services are required.

**F03 [P0] Pack installation and readiness**

Offer size/progress/cancel/checksum/version controls for selected packs. Use an Offline ready check that tests actual availability.

Acceptance (AT-F03): The readiness screen identifies missing packs or providers rather than showing a false ready badge.

**F04 [P0] Loss recovery without duplicate sends**

Preserve permitted progress during network failure; reconnection does not auto-submit. Refresh session/data and use idempotency for approved submission.

Acceptance (AT-F04): A lost response/retry does not create duplicate applications or discard the draft.

**F05 [P0] Small, measured core**

Keep model/audio/font payloads optional, avoid continuous uploads and remote assets, and target 150 KB compressed core JS/CSS. Measure actual size and inference impact.

Acceptance (AT-F05): The report lists measured bundle bytes and any unmet performance target instead of an unsupported claim.

### Four languages and multiple devices

**L01 [P0] Language-pack architecture**

Support en, am, ti and om configuration with separate UI, command, transcription, dynamic TTS and wake capabilities.

Acceptance (AT-L01): Each language/capability is independently marked verified, partial, unavailable or not tested.

**L02 [P1] Reviewed translations and prompt audio**

Obtain native-speaker review of question text and simpler explanations; use licensed recordings where useful. Recordings do not imply arbitrary TTS.

Acceptance (AT-L02): Review evidence and missing dynamic-read-aloud capability are accurately recorded.

**L03 [P0] Free, replaceable model providers**

Keep useful local rules/templates; evaluate local LLM/ASR/TTS providers with current official cards, licences and real device recordings. No required paid API.

Acceptance (AT-L03): The chosen profile runs with documented dependencies/costs, and unsupported language claims are absent.

**L04 [P1] Language switching and cross-platform matrix**

Switch available languages without losing answers. Test Windows/macOS/Linux and Android/iOS browser profiles; use lighter profiles when needed.

Acceptance (AT-L04): The matrix names tested browser/OS/provider versions and identifies untested combinations.

**L05 [P1] Ethiopic script and explicit calendar context**

Verify Amharic/Tigrinya glyph rendering, readable fonts and mixed-script input. If Ethiopian calendar dates are offered, label the calendar clearly and validate conversion against the host format.

Acceptance (AT-L05): A reviewed mixed-script example remains readable; dates are never silently reinterpreted between calendars.

### Privacy, safety and maintainability

**P01 [P0] Validated proposals and host authority**

Validate every intent with a schema and fresh target registry. The trusted host controls action permissions and confirms sensitive/external writes.

Acceptance (AT-P01): Unknown/stale targets, unknown intents, extra executable fields and forged permission flags are rejected.

**P02 [P0] Untrusted-page isolation**

Treat website text as data. Do not execute model-generated code, selectors, shell commands, file paths or arbitrary destinations.

Acceptance (AT-P02): Malicious page instructions cannot redirect a private answer or execute an undeclared action.

**P03 [P0] Minimum data and separate recipients**

Do not retain raw audio or personal telemetry by default. Unknown field privacy stays conservative; private support and identity files use separate authorised routes.

Acceptance (AT-P03): Payload and storage tests demonstrate separation, consent and deletion behaviour.

**P04 [P1] Preference profile and shared-device reset**

Offer opt-in text size/speed/contrast/language preferences without disability labels. Provide a clear shared-device reset.

Acceptance (AT-P04): Reset removes saved preferences and permitted drafts, with no promise to revoke already shared server data.

**P05 [P1] Recovery and action explanations**

Explain in plain language what changed, what failed and how to recover; keep an ephemeral non-PII action status trail.

Acceptance (AT-P05): A learner can identify the current step and recover from an error without reading a technical log.

### Install, demonstrate and scale

**I01 [P0] One-script SDK and teardown**

Bundle a loader/core with mount/unmount, events and configuration; scope styles and respect CSP. Avoid changing existing code solely to adopt a new framework.

Acceptance (AT-I01): The same bundle installs on two differently structured labelled hosts with no manual basic-form schema.

**I02 [P0] Savanna adapter and API contract**

Integrate the provided starter if available; otherwise isolate the adapter boundary and mark integration unverified. Provide relevant REST/OpenAPI contracts.

Acceptance (AT-I02): A second engineer can follow the docs; no unavailable integration is presented as working.

**I03 [P0] Evidence and complete handoff**

Provide README, Docker Compose, contracts, source, tests, capability matrix, licence/cost notes, accessibility evaluation and demo script.

Acceptance (AT-I03): A stranger attempts installation within an hour and actual results are documented.

**I04 [P1] Scalable service boundaries**

Keep public static assets cacheable, APIs appropriately stateless, private data tenant-isolated and inference concurrency bounded.

Acceptance (AT-I04): A capacity report names measured hardware/load and does not confuse learner count with concurrent voice sessions.

**I05 [P2] JobPosting standard and extension route**

After the primary flow passes, evaluate schema.org/JobPosting export and an explicit browser-extension distribution route.

Acceptance (AT-I05): Standards are validated where implemented; extension limitations on mobile/other origins are documented.

### Useful stretch features after the gate

**B01 [P2] Partner-assisted registration**

Use authenticated partner roles, learner-readable consent, review and an audit trail. Do not imply an actual AAAPD partnership without agreement.

Acceptance (AT-B01): A configured partner can prepare an application and learner approval is recorded before sharing.

**B02 [P2] SMS resume link**

Use opaque revocable tokens, retention/recovery rules and a real configured delivery provider. No answers/private needs in URLs.

Acceptance (AT-B02): A real consenting tester resumes through the verified provider; cost and connectivity requirements are stated.

**B03 [P2] Private human-help handoff**

Allow a learner-controlled request for support with a preview of the minimum context to share. Screen sharing is a separate opt-in action if added.

Acceptance (AT-B03): No silent screenshots, transcripts, documents or sensitive answers leave the device.

**B04 [P2] Task walkthrough and local feedback**

Offer a short accessible practice task and voluntary non-identifying feedback. Do not make a new analytics service necessary.

Acceptance (AT-B04): Practice is clearly distinguished from a real submission and feedback is optional.

## State and action rules

Use explicit states for disabled, ready, listening, processing, speaking, candidate answer, awaiting confirmation, paused and recoverable error. The interface always exposes Stop and a text alternative. Network submission states are prepared, awaiting approval, sending, received, failed or unknown; never display received without a host receipt.

The pipeline is capture -> local command/optional LLM proposal -> schema validation -> current registry resolution -> host permission/confirmation -> execution -> result announcement. The model cannot authorise itself. Stale map versions must re-resolve or request clarification. User intent must be distinguishable from commands quoted inside a dictated answer or malicious webpage text.

Do not clear a draft because a recording limit, security token or host session expires. Explain recovery. A final confirmation authorises only its stated operation and recipient; it is not permission for unrelated future actions. Reconnection does not automatically submit.

## Performance and operational targets

Target a compressed core JS/CSS payload of at most 150 KB, excluding optional packs; preference updates within 200 ms after a recognised intent; and a documented offline reload test with zero outbound requests for the device-local profile. These are targets, not existing measurements. For a hub profile state that LAN is required and document trusted transport.

Measure on the actual selected device. Keep inference out of the UI thread. Use bounded queues, rate controls, timeouts with recovery and tenant-safe storage. Public static packs may be cached; private answers and raw audio must not enter shared caches or generic logs. No required paid API is allowed. Free software still has compute, download, hosting and possible SMS costs.

## Deliverables and completion

Deliver a running SDK, ordinary-host examples, available Savanna integration, model/provider setup, one-script output, schema contracts, REST/OpenAPI where implemented, Docker Compose, tests, README, capability/device matrix, accessibility evaluation, cost/licence notes, demo script and a truthful known-limitations list. Reuse an existing project rather than spending the event rewriting its framework.

A prototype is ready to demonstrate when a real learner can complete the main flow, private data stays private, a second host works with the same core, offline behaviour is measured and verification limitations are visible. A broader product release requires the remaining language, device, security, capacity and native-platform gates; a prototype demo does not imply those gates passed.
