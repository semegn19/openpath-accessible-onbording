# Roha acceptance tests

All tests below are planned runtime tests. The provided schema checker validates only handoff contracts/examples. Record environment, command/manual steps, expected and actual result, status, evidence path, source commit and whether speech is real or synthetic. Use passed, failed, blocked, not-tested or not-applicable with a reason.

## End-to-end gate scenarios

1. Fresh ordinary host, no supplied map: discover content/form, enlarge real text, explain one question and complete registration through review.
2. No-ID learner: choose referral/another allowed route, avoid forced national-ID upload, keep private support separate, review and approve only the intended recipient.
3. Career: apply with the same engine, filter example jobs privately and create an employer accommodations listing; sample data stays labelled.
4. Offline: install declared packs, disconnect internet, reload, recover a permitted draft and reach local review. Record whether LAN remains necessary. Reconnect without auto-send.
5. Recovery: deny mic, interrupt provider, remove a DOM target, add a field and create duplicate button names; errors remain actionable and answers are preserved.
6. Security/privacy: hostile page instructions, malformed intent, injected code, stale map version, unknown target and forged confirmation are rejected by the runtime validator/host authority. Audit exports, storage and logs for private support or identity data.
7. Adoption: another engineer installs the same bundle on a second differently structured ordinary fixture, without hand-authoring its basic form schema. Measure installation time.
8. Human accessibility gate: keyboard, NVDA, TalkBack, sound off, 200% zoom and co-designer unaided task. Record actual assistance/failures; do not fabricate outcomes.

## Per-feature tests

### AT-D01: Automatic page discovery

Requirement: D01 (P0).

Expected: A new labelled fixture is understood without a supplied site schema.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D02: Accessible names and ambiguity

Requirement: D02 (P0).

Expected: Two Apply buttons in different job cards are identified by job context; an ambiguous request asks which one.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D03: Generated JSON map and live registry

Requirement: D03 (P0).

Expected: Schema-valid map references current targets; stale or invented target IDs cannot execute.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D04: Dynamic pages and navigation

Requirement: D04 (P0).

Expected: A dynamically added labelled field appears once; removed fields cannot receive later proposals.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D05: Optional host overrides

Requirement: D05 (P0).

Expected: One script works on two ordinary hosts; an override improves a custom control without changing the core.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D06: Honest unsupported-control handling

Requirement: D06 (P0).

Expected: Roha gives a plain fallback or asks the host for support; it never invents a successful interaction.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-D07: Website compatibility report

Requirement: D07 (P1).

Expected: A host engineer can see actionable integration gaps without learner data.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V01: Enable voice and visible permission state

Requirement: V01 (P0).

Expected: Denied permission leaves a usable keyboard/text flow with no answer loss.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V02: Natural turn-taking

Requirement: V02 (P0).

Expected: One real recorded conversation fills several answers without microphone clicks between fields.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V03: Foreground name activation

Requirement: V03 (P1).

Expected: Activation works in the documented foreground/device profile; unavailable wake support is labelled.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V04: Conversation state and answer correction

Requirement: V04 (P0).

Expected: A deliberately misheard answer is corrected and the right value remains after back/next navigation.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V05: Voice navigation and recovery

Requirement: V05 (P0).

Expected: Core intents work through a local command router even when the LLM is disabled; text alternatives work.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V06: No invented user information

Requirement: V06 (P0).

Expected: Roha asks an unknown name and never fabricates contact, identity, qualification or eligibility details.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V07: Spelling and number verification

Requirement: V07 (P1).

Expected: A mixed spelling/number example can be corrected without unintended Next or Submit actions.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-V08: Interruption and resume recap

Requirement: V08 (P1).

Expected: Stopping does not discard accepted answers; resume states the current task without exposing private details aloud.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A01: Real text scaling and reset

Requirement: A01 (P0).

Expected: Voice or text enlarges actual host content, reset works, and 200% zoom remains usable.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A02: Simple explanation with original available

Requirement: A02 (P0).

Expected: The simpler question preserves consent/eligibility choices and the original remains available.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A03: Read-aloud and page navigation

Requirement: A03 (P0).

Expected: The correct content is read or focused, and Stop always works.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A04: Contrast, motion and calm view

Requirement: A04 (P1).

Expected: Settings do not remove instructions, status meaning or controls; reset restores the host view.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A05: Keyboard, screen reader and sound-off parity

Requirement: A05 (P0).

Expected: The complete primary task is testable with keyboard, NVDA, TalkBack, sound off and 200% zoom.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A06: Orientation: where am I?

Requirement: A06 (P1).

Expected: Roha explains the actual page and offers only actions currently present.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A07: Preview and undo local changes

Requirement: A07 (P1).

Expected: An accidental local change is reverted; completed external writes are clearly distinguished.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-A08: Optional reading focus and spacing

Requirement: A08 (P2).

Expected: The enhancement is reversible and passes the same keyboard/zoom checks as the default view.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O01: Sign-up and profile engine

Requirement: O01 (P0).

Expected: The learner completes and edits a profile without duplicate IDs or conflicting controls.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O02: Voice answers, review and edit

Requirement: O02 (P0).

Expected: A learner can reject or edit any recognised answer before sharing.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O03: No form inactivity timer

Requirement: O03 (P0).

Expected: After an idle period, the task remains recoverable; Roha does not claim it can extend host authentication.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O04: Low-literacy route

Requirement: O04 (P0).

Expected: The low-literacy route reaches review with text/sound-off alternatives.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O05: Alternative ID routes

Requirement: O05 (P0).

Expected: A learner without national/kebele ID or passport reaches review without a forced national-ID upload.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O06: Private support without medical proof

Requirement: O06 (P0).

Expected: Support content is absent from employer/public exports, generic completion events and telemetry.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O07: Learner-controlled attachments

Requirement: O07 (P0).

Expected: The learner chooses a document; Roha neither scans folders nor pretends voice bypasses browser/OS permission.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O08: Consent, review and truthful submission

Requirement: O08 (P0).

Expected: No submission occurs before approval; success requires a real host receipt.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-O09: Minimal save/resume and deletion

Requirement: O09 (P0).

Expected: A recovered draft explains omitted fields and does not include sensitive/private data.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-C01: Conversational job application

Requirement: C01 (P0).

Expected: A sample job application reaches review through the same reusable SDK.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-C02: Private support-needs job filter

Requirement: C02 (P0).

Expected: A supported filter changes matching examples locally without disability inference or disclosure.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-C03: Employer accommodations form

Requirement: C03 (P0).

Expected: An employer listing supplies meaningful declared accommodations for filtering.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-C04: Job context and application checklist

Requirement: C04 (P1).

Expected: Roha does not invent a live vacancy, requirement, employer promise or completed application.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-F01: Host-origin offline cache

Requirement: F01 (P0).

Expected: After installation, the declared offline journey survives an internet-disconnected reload.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-F02: Explicit runtime profiles

Requirement: F02 (P0).

Expected: The UI honestly states whether internet, LAN or installed local services are required.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-F03: Pack installation and readiness

Requirement: F03 (P0).

Expected: The readiness screen identifies missing packs or providers rather than showing a false ready badge.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-F04: Loss recovery without duplicate sends

Requirement: F04 (P0).

Expected: A lost response/retry does not create duplicate applications or discard the draft.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-F05: Small, measured core

Requirement: F05 (P0).

Expected: The report lists measured bundle bytes and any unmet performance target instead of an unsupported claim.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-L01: Language-pack architecture

Requirement: L01 (P0).

Expected: Each language/capability is independently marked verified, partial, unavailable or not tested.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-L02: Reviewed translations and prompt audio

Requirement: L02 (P1).

Expected: Review evidence and missing dynamic-read-aloud capability are accurately recorded.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-L03: Free, replaceable model providers

Requirement: L03 (P0).

Expected: The chosen profile runs with documented dependencies/costs, and unsupported language claims are absent.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-L04: Language switching and cross-platform matrix

Requirement: L04 (P1).

Expected: The matrix names tested browser/OS/provider versions and identifies untested combinations.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-L05: Ethiopic script and explicit calendar context

Requirement: L05 (P1).

Expected: A reviewed mixed-script example remains readable; dates are never silently reinterpreted between calendars.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-P01: Validated proposals and host authority

Requirement: P01 (P0).

Expected: Unknown/stale targets, unknown intents, extra executable fields and forged permission flags are rejected.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-P02: Untrusted-page isolation

Requirement: P02 (P0).

Expected: Malicious page instructions cannot redirect a private answer or execute an undeclared action.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-P03: Minimum data and separate recipients

Requirement: P03 (P0).

Expected: Payload and storage tests demonstrate separation, consent and deletion behaviour.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-P04: Preference profile and shared-device reset

Requirement: P04 (P1).

Expected: Reset removes saved preferences and permitted drafts, with no promise to revoke already shared server data.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-P05: Recovery and action explanations

Requirement: P05 (P1).

Expected: A learner can identify the current step and recover from an error without reading a technical log.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-I01: One-script SDK and teardown

Requirement: I01 (P0).

Expected: The same bundle installs on two differently structured labelled hosts with no manual basic-form schema.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-I02: Savanna adapter and API contract

Requirement: I02 (P0).

Expected: A second engineer can follow the docs; no unavailable integration is presented as working.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-I03: Evidence and complete handoff

Requirement: I03 (P0).

Expected: A stranger attempts installation within an hour and actual results are documented.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-I04: Scalable service boundaries

Requirement: I04 (P1).

Expected: A capacity report names measured hardware/load and does not confuse learner count with concurrent voice sessions.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-I05: JobPosting standard and extension route

Requirement: I05 (P2).

Expected: Standards are validated where implemented; extension limitations on mobile/other origins are documented.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-B01: Partner-assisted registration

Requirement: B01 (P2).

Expected: A configured partner can prepare an application and learner approval is recorded before sharing.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-B02: SMS resume link

Requirement: B02 (P2).

Expected: A real consenting tester resumes through the verified provider; cost and connectivity requirements are stated.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-B03: Private human-help handoff

Requirement: B03 (P2).

Expected: No silent screenshots, transcripts, documents or sensitive answers leave the device.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

### AT-B04: Task walkthrough and local feedback

Requirement: B04 (P2).

Expected: Practice is clearly distinguished from a real submission and feedback is optional.

Initial status: not tested. Add concrete steps and actual evidence during implementation.

## Automated and manual evidence

Run appropriate unit/integration tests on the action router, schema/registry checks, visibility changes, draft minimisation, private/public separation, idempotency and provider failures. Browser tests must exercise actual discovery and host effects. A fixture map JSON or mocked voice service does not prove these are implemented.

Run axe on the full host and all relevant states: question types, error, file/consent step, dialog, review, career filter, employer form and assistant settings. Fix critical/serious issues; inspect other findings. Manual focus, screen-reader, meaning, voice accuracy and co-designer checks remain necessary. Maintain the WCAG 2.2 AA evaluation honestly.

For speech hardening after the event, test consenting speakers in each requested language with names, numbers, corrections, noise and task utterances. Measure task success, corrections, latency, missed wake phrases and false activations. Do not represent a small pilot as population-wide validation.
