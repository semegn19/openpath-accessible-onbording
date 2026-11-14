# Roha implementation evidence — 14 November 2026

This report records implementation and local measurements for the approved accessibility, provider interface, embedding and production foundations plan. It does not certify production readiness or support for every disability. No real learner data or paid model credentials were used. Existing user changes were preserved; the unapproved App.tsx hook extraction was not started.

## Requirements checked

The supplied opening presentation, technical guide, web-component/API PDF and WCAG presentation require an adoptable component, keyboard access, visible equivalents for speech, low-bandwidth behavior, server-owned API keys, and evaluation with co-designers on their own devices. Their co-designer gate cannot be replaced by automated tests. The older WCAG 2.0 PDF is background; the repository's current target remains WCAG 2.2 AA.

The implemented assistant enhances the existing learner/job/employer forms and a plain host page. It is not an operating-system assistant equivalent to Siri, a replacement for assistive technology, or a universal repair layer for arbitrary websites.

## Changes by wave

| Wave | Implemented | Remaining release work |
|---|---|---|
| 0 — baseline | Repaired receipt/control detection; offline tests use available ports, validate child readiness, and simulate deployed gzip; retries use actual receipt form ID | None for the repaired automated baseline |
| 1 — accessible interaction | Typed input, keyboard dialog, focus return, host-field focus transfer, 44px assistant buttons, visible responses, narrow-screen reflow, Amharic/English interface and assistant response copy, Stop suppresses late AI actions | Native Amharic review; real screen-reader, motor/switch and cognitive usability sessions |
| 2 — provider administration | Authenticated settings UI; OpenAI/Gemini/Claude/Ollama/custom adapters; encrypted server credentials; approved endpoints/origins; explicit learner consent; revision conflicts; bounded validated actions; real logout revocation | Live provider/account/model verification; organisation identity/SSO if needed |
| 3 — plugin | Working aliases; explicit target root; lifecycle cleanup/remount; public ready/error events; API/language script attributes; plain host fixture; external stylesheet | Partner CSS/CSP/browser integration; full Shadow DOM isolation and multiple simultaneous assistants are not provided |
| 4 — storage/recovery | PostgreSQL schema migration, transactional existing-data import, offline database/file key rotation, encrypted sensitive fields/config, atomic form-scoped idempotency, shared sessions/limits, retention command, production receipt privacy, offline assistant assets, scoped service-worker cache cleanup | Operator rehearsal/cutover of any real legacy data; device-specific draft/privacy review; managed-database restore drill |
| 5 — operations/scaling | Pool/concurrency/body/response/time limits, shared request budgets, process counters, readiness, production startup guards, Compose profile, container builds | Real traffic/load targets, ingress abuse protection, TLS, monitoring/alert destinations and deployment sizing |
| 6 — verification | Runtime, Chromium/axe, gateway, two-worker database integration, local backup/restore and CSP checks | Firefox/Safari/Android; NVDA/TalkBack/switch hardware; live providers |
| 7 — pilot/release | Setup, migration, backup, rollback, retention and incident runbook; pilot acceptance checklist below | Named organisation, hosting, co-designers and observed pilot results; no public deployment performed |

## Measured verification

Commands below are from the repository root unless marked otherwise. Logs were captured under `/tmp/roha-*.log` during this session; they are local run artifacts, not durable CI evidence.

| Command | Result |
|---|---|
| `cd app && npm run check` with Vite on 5173 | Exit 0, 261 lines beginning ✓, 0 lines beginning ✗. This is a marker count, not 261 independent assertions; the gate includes build markers. |
| `npm --prefix app run build` | TypeScript, Vite and both standalone bundles pass. Assistant bundle 103,661 raw bytes after response localisation. |
| `npm --prefix app run test:roha` | 109/109 runtime checks. Includes mocks and integration seams, not claims of live partner services. |
| `npm --prefix app run test:access` | 14/14 assistant browser checks at 320/640 CSS pixels, including axe, labels, target sizes and keyboard behavior. |
| `npm --prefix app run test:localisation` | 27/27 Chromium checks: action feedback, speech/visible parity, all voice states, errors, confirmations, review/resume, barrier help, integration feedback, AI descriptions and language remount. All 87 response templates have Amharic text and matching placeholders. |
| `TEST_DATABASE_URL=... npm --prefix api run test:storage` | 42/42 PostgreSQL/file/CLI checks: dry runs, receipt preservation, duplicates/conflicts, distinct keys, plaintext import, both encrypted formats, corrupt-data rollback, session revocation and restricted file publication. Synthetic data only. |
| `npm --prefix app run test:settings` | 23/23 browser checks for admin settings, consent, late response suppression, host focus and custom-element lifecycle. API responses mocked. |
| `npm --prefix api test` | 32/32 server checks; five provider response adapters mocked. No external model calls. |
| `TEST_DATABASE_URL=... npm --prefix api run test:database` | 9/9 real PostgreSQL checks. 100 concurrent writes across two pools yield one receipt; exactly 7 of 40 concurrent budget reservations accepted with a limit of 7. |
| `TEST_DATABASE_URL=... npm --prefix api run test:replicas` | 10/10 checks against real API processes. 40 concurrent retries across two workers yield one 201 and 39 matching 200 receipts; encryption, sessions, config sharing and restart recovery pass. |
| `TEST_DATABASE_URL=... npm --prefix api run test:backup` | 4/4 local pg_dump/pg_restore checks in 274 ms with tiny synthetic data. Restores migration metadata, decryptable personal data, encrypted config and idempotency. This is not a deployment RTO. |
| `npm --prefix app run offline` after final service-worker change | Exit 0, 23 checks, 0 failures. 253 KB transferred; first question 6,138 ms under simulated Slow 3G. Assistant remains available offline. |
| `npm --prefix app run verify:prod` | Exit 0; 17 axe audits, no reported violations, strict CSP checks pass for the three forms and administrator page. |
| `python3 Roha_Agent_Handoff/tests/validate_contracts.py` | Pass; this is structural contract validation, not runtime or accessibility certification. |
| `docker build -f api/Dockerfile ...` and `docker build -f app/Dockerfile ...` | Both local images build. API image loads pg; forms image passes `nginx -t`. Production Compose configuration validates. |

The full gate was rerun after existing-data tooling and Amharic response localisation: exit 0, the same 261 ✓ markers as the baseline and no failures. An initial parallel assistant accessibility run timed out after a DOM detach during shared dev-server rebuild activity; the subsequent sequential run passed 14/14 accessibility and 23/23 settings checks. No form-engine refactor was included. The migration/rotation tools have only operated on synthetic test data, not a live installation. Existing real data still needs an operator backup and offline cutover using the operations guide.

A measured focus defect was repaired: before the fix, `executeIntent(focus)` returned success while the active input remained inside the modal. Afterwards the regression test confirms that the dialog closes and focus stays in the host form.

## Pilot acceptance checklist

Record browser/OS, assistive technology/version, device, task, observed outcome and participant feedback. Ask what support the person prefers; do not infer it from a diagnosis. Use synthetic personal information. Obtain consent for observation and do not collect recordings by default.

- Complete learner registration, including the no-standard-ID route, without facilitator intervention. Repeat the job and employer tasks relevant to the organisation.
- Complete the same tasks with keyboard only, NVDA, TalkBack, sound off, and the participant's own motor/switch input. Check errors, focus order, Escape, dialog-to-form focus and hidden/covered controls.
- Check 200% zoom, 320 CSS-pixel reflow, text spacing and forced-colors on actual supported devices. Current automated 320px tests are not all of these manual checks.
- For cognitive accessibility, observe whether the participant understands the current question, help, review, correction, progress, saved-on-device state and final receipt. Check that assistance does not rush them or change their answer without understanding.
- Disconnect mid-task, close/reopen, submit offline, reconnect, verify one receipt and erase local drafts on a shared device. Confirm exactly what persists on the device.
- Review AI consent in the participant's preferred language; verify decline, provider change, failure, Stop and local fallback. Run each chosen provider with synthetic requests before allowing real data.
- Verify HTTPS/microphone behavior, database backup and restore on the actual hosting platform, rate/cost limits, monitoring, support ownership and rollback. Set measured latency/error/RPO/RTO targets with the organisation.

Do not mark the pilot or WCAG conformance complete until these observations exist. The current session had no named pilot organisation, co-designer, live provider credentials or deployment destination.

## Primary implementation references

Provider formats were checked against [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Gemini generateContent](https://ai.google.dev/api/generate-content), [Claude Messages](https://platform.claude.com/docs/en/api/http/messages), and [Ollama generate](https://docs.ollama.com/api/generate). SQL values use [node-postgres parameterized queries](https://node-postgres.com/features/queries).

See [the operations guide](roha-operations.md) for configuration, limitations and recovery commands. `api/openapi.yaml` is the specification served by the running API; the older root `openapi.yaml` contains proposed contracts and should not be treated as implemented endpoint parity.
