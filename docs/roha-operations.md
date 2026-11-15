# Roha installation and operations

This implementation supports one organisation per deployment/database. It does not implement tenant isolation, enterprise SSO, arbitrary desktop control, or unrestricted autonomous form submission. Keep AI disabled until the organisation has approved the provider and completed the release checks in `roha-implementation.md`.

## Local setup

From the repository root:

```bash
npm --prefix app ci
npm --prefix api ci
cp .env.example .env
# Fill DATA_KEY and ROHA_ADMIN_TOKEN with separate random values (at least 32 characters).
# DATA_KEY must decode to exactly 32 bytes. Set ROHA_ADMIN_ORIGIN to the browser's exact origin.
node --env-file=.env api/server.mjs
```

In another terminal:

```bash
npm --prefix app run build
npm --prefix app run dev -- --strictPort
```

Use `http://localhost:5173/roha-admin.html` if that is the configured administrator origin. `127.0.0.1` and `localhost` are different origins. Sign in, choose the provider and account-supported model, enter the key, optionally test, then save. Testing makes one real provider call and may incur charges. No model names are assumed to be available forever. The test does not save settings. An empty key input retains the saved key only for the same provider and endpoint; switching providers requires a new key. Selecting Disabled removes the previous provider's key from the current configuration. Encrypted backups can still contain old keys.

Node does not read `.env` without `--env-file`. The default development file store is one process only. Its sessions and limits reset on restart. Do not horizontally scale that mode.

## Production profile

Populate `.env` with `ROHA_DEPLOYMENT=production`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DATA_KEY`, `ROHA_ADMIN_TOKEN`, `ALLOWED_ORIGIN` and `ROHA_ADMIN_ORIGIN`. Both origins must use HTTPS. The database URL for Compose uses hostname `db`, database/user `roha`, and a URL-encoded password matching `POSTGRES_PASSWORD`.

```bash
docker compose -f docker-compose.yml -f compose.production.yml config --quiet
docker compose -f docker-compose.yml -f compose.production.yml up -d --build
```

Provision a trusted HTTPS ingress in front of the forms container on port 8080. Do not expose the API or database port publicly. The checked-in Compose profile does not obtain TLS certificates or configure your hosting provider. Nginx overwrites client-provided forwarding headers. `TRUST_PROXY=1` is only appropriate behind this trusted proxy. Restrict inbound access to the ingress; disable nginx access logging of receipt URLs or use a path-redacting access log because receipt IDs are bearer tokens.

The `migrate` job runs before the API. For managed PostgreSQL, run `DATABASE_URL=... npm --prefix api run migrate` as a release job and use a runtime account with table/sequence privileges but no schema modification privileges. Configure verified TLS for a remote database; do not set `rejectUnauthorized=false`. The additive version-1 migration is repeatable and serialized with an advisory lock. Future breaking migrations need separate expand/contract releases and backups.

Production startup fails without storage, encryption, administrator credentials and HTTPS origins. `/api/health` checks database availability; a storage failure returns 503. The production submission lookup returns receipt metadata only, never answers. The development JSONL store remains available for local demos. Existing JSONL installations can use the explicit import tool below before switching storage. API startup never imports files automatically.

Use a separate database per organisation. Application replicas share config revisions, login sessions, rate limits and durable submission idempotency. Each worker uses at most ten database connections and eight concurrent AI calls; size database connection limits for the number of workers. Nginx service discovery/ingress configuration must be verified when scaling containers; this profile alone is not an autoscaler.

## Provider and plugin contracts

The browser uses `/api/assistant/config` and `/api/assistant/interpret`. Learners see the selected provider/model and explicitly consent. Config revisions invalidate earlier consent. The server sends only the typed utterance and public resource IDs/allowed actions, never form values, labels, private support fields or documents. A learner can still type personal information into their own message; the consent text covers sending that message. Provider retention terms must be reviewed separately. OpenAI requests use `store:false`, which is not a blanket claim about vendor retention.

Server adapters: OpenAI Responses, Gemini generateContent, Claude Messages, Ollama generate, or custom REST. The operator must allow exact Ollama/custom URLs in `ROHA_AI_ENDPOINTS` (comma-separated). Local HTTP is allowed for trusted internal services. Protect that network and endpoint from DNS rebinding or redirection by network policy; redirects are refused by the client. An administrator cannot add a destination outside the operator allowlist. Empty allowlist disables custom/Ollama destinations.

A custom endpoint receives a POST with `model`, `instructions`, and `input`; an optional API key is sent as a Bearer header. Return JSON such as:

```json
{"intent":"text_scale","targetId":"page.main","payload":{"percent":150}}
```

Only the target IDs/actions in the request are accepted. Safe actions are text scaling (100/125/150/175/200), contrast, simple mode, reduced motion, reading, explanation, focus, pause, resume and undo. Payloads are strictly checked. AI cannot propose filling or submitting answers through this gateway. Responses are capped at 64 KiB and requests at 32 KiB; provider calls have a 12-second deadline. One installation has a shared 60/minute and configurable daily request budget. Daily windows last 24 hours from the first request. Failed and rejected provider calls can consume budget. These are request limits, not currency/token billing caps; set provider-side billing limits too. Origins are deployment policy, not authentication against non-browser clients; protect public endpoints with ingress abuse controls for a public launch.

```html
<main id="application"><!-- existing accessible host content --></main>
<roha-agent for="application" language="am"
  api-endpoint="https://roha.example/api/assistant"></roha-agent>
<script defer src="https://roha.example/roha.js" data-roha-auto="false"></script>
```

Serve `roha.css` beside the script and permit the script/style/API origins in host CSP. Add the host origin to `ROHA_EMBED_ORIGINS`. Alternatively use `data-roha-root`, `data-roha-language` and `data-roha-api` on the script for automatic attachment. The plugin enhances existing content; it does not create a form or repair inaccessible host semantics. Both `roha-agent` and `roha-assistant` work. Removal disconnects listeners/observers and cancels pending UI actions. Changes to `for`, `language` or `api-endpoint` remount safely. `roha:ready` exposes map ID/version; `roha:error` exposes an error code, without form values. One active assistant per document is supported because preferences affect the whole document. Prefix-scoped CSS is not Shadow DOM isolation; test the adopting site's CSS.

Roha is an inline panel, beside the OpenPath form on wide screens and below it on small screens. The page remains interactive. The “Talk to Roha” button requests microphone access and starts listening after permission is granted; rendering the panel does not request access. No spoken welcome delays the first command. Stop or Escape inside the panel cancels listening and pending answer approval, including a permission request that resolves late. If access is denied or speech is unavailable, typed commands and buttons remain usable. “Bigger text” (including “bigger test”) enlarges page text; “zoom in” and “zoom out” use the same text-size controls, up to 200%. These commands resize text rather than changing the browser’s zoom setting.

AI is optional; typed local commands and buttons continue without it. Stop prevents a delayed result from changing the page but cannot recall data already sent to a provider. Browser speech recognition is a separate opt-in path and may use the browser vendor's remote services. Background wake-word, SMS and human handoff integrations still require real services.

## Backup, retention and recovery

Back up PostgreSQL using `pg_dump -Fc`, encrypt/restrict the resulting archive, and keep the matching `DATA_KEY` in a separate secret manager. Never commit database dumps or keys. A database backup alone cannot decrypt records. Keep each backup’s matching key; changing `DATA_KEY` alone makes previous data/config unreadable. Use the explicit rotation tool below to re-encrypt current storage. It does not rotate backup archives or update your secret manager.

Example commands for an operator-controlled shell (variables already exported):

```bash
pg_dump --dbname="$DATABASE_URL" --format=custom --file=roha-backup.dump
# Restore into an EMPTY recovery database, never overwrite the live database during a drill.
pg_restore --dbname="$RECOVERY_DATABASE_URL" --no-owner --exit-on-error roha-backup.dump
```

Start a recovery API with the restored database and original key. Verify health, a known receipt, decryptability through your authorised operator tooling, and retry the original `clientRef` to verify the same receipt. No end-user answer export API is supplied. Restrict database access accordingly. The repeatable local synthetic-data drill is `TEST_DATABASE_URL=... npm --prefix api run test:backup` (requires pg_dump and pg_restore). It creates and drops only its own random test schema. Record the measured backup age and restore duration; set RPO/RTO with the pilot organisation rather than inventing targets. Rollback application images without deleting the DB volume; never run `docker compose down -v` on a live installation.

Agree a retention period before collecting real data. Then schedule `RETENTION_DAYS=... node api/maintenance.mjs --apply` with the database URL exported. It removes expired submissions, sessions and limits. Apply the same policy to backups; deletion from the live database does not erase backups. This command is deliberately not scheduled automatically.

The existing browser draft/outbox contains personal answers on the device to support offline recovery. It is not encrypted storage and must be tested on shared devices. A server retention job cannot erase a disconnected device. Explain local drafts and exercise the existing reset/delete flow before a shared-device pilot.

## Existing-data import and encryption-key rotation

These commands operate on server submissions and encrypted assistant settings. They do not migrate browser drafts/outboxes, SMS token registries, or external provider accounts. Rehearse against a restored copy before the live cutover. The automated test is `TEST_DATABASE_URL=... npm --prefix api run test:storage`; it uses temporary files and its own random database schema.

All commands default to **dry run**. Database dry runs execute the same writes inside a transaction and roll back; they briefly lock submissions, settings and sessions, so schedule them in a maintenance window too. Commands emit JSON counts only, or a controlled error code and JSONL line number. Malformed JSONL (including a truncated final line), unknown forms and undecryptable ciphertext stop the operation; no records are silently skipped. Import also rejects unknown answer fields and conflicting receipts. Keep the schemas for every stored form in `SCHEMA_DIR` (default: repository `schema/`). Run the tool with a database maintenance account that can create temporary tables, update data and lock the affected tables.

Before **applying**: stop every API replica and scheduled maintenance worker, block incoming writes, and back up both data and the matching keys. `--offline` is your acknowledgement that these processes are stopped; it does not stop them for you. A database lock cannot prevent an old-key worker from writing after the transaction commits. Keep workers stopped until the new storage/key configuration is installed everywhere.

### Import JSONL into PostgreSQL

Set `DATABASE_URL` to the destination and `DATA_KEY` to its encryption key in a protected operator environment. Set `SOURCE_DATA_KEY` to the original key if any source answer or assistant configuration is encrypted; omit it for a fully plaintext source. Keys must be canonical base64 encoding of exactly 32 bytes. Never pass keys in CLI arguments or paste real values into command history.

```bash
# Prepare the destination tables; this is additive and repeatable.
npm --prefix api run migrate
# Reads submissions.jsonl and, when present, assistant-config.enc.json.
node api/storage-cli.mjs import --source-dir /secure/legacy-data
# Inspect counts, then apply while every writer is stopped.
node api/storage-cli.mjs import --source-dir /secure/legacy-data --apply --offline
```

The source files remain untouched. Receipt IDs, form IDs, retry references and timestamps are preserved. Current schema personal/sensitive fields and previously encrypted fields are encrypted with the destination key. Local-only/support/medical fields forbidden by the current submission policy are stripped, with field names retained in `stripped`. Compare `strippedFields` with the approved retention policy before applying. Unknown fields need an explicit schema/data decision; they are not silently imported.

Identical duplicate records and a repeated import are accepted without creating new receipts. Different contents sharing an ID or form/retry reference fail the entire transaction. Existing provider settings must match the source exactly (including revision) or the import fails; the tool never overwrites a different administrator configuration. Existing destination ciphertext must decrypt under `DATA_KEY`. All submissions and settings commit together. Point every API replica at the destination database with that key, restart, verify health, a known receipt and the same receipt on retry, and verify administrator settings. Keep the source backup until the cutover is accepted. Reverting to the source after new submissions arrive needs reconciliation; it would otherwise lose those new submissions.

### Rotate PostgreSQL encryption

Export `DATABASE_URL`, `OLD_DATA_KEY` and a freshly generated independent `NEW_DATA_KEY` through your secret manager or protected environment. These maintenance variables are separate from the running API’s `DATA_KEY`.

```bash
node api/storage-cli.mjs rotate
node api/storage-cli.mjs rotate --apply --offline
```

One transaction re-encrypts sensitive answers and provider credentials and revokes administrator sessions. IDs, retry references, timestamps and provider revision stay unchanged. Wrong keys, corrupt data or failure before commit roll back every change. A repeat invocation with the retired key fails closed. After success, set **every replica’s `DATA_KEY` to `NEW_DATA_KEY` before restarting**; verify health, receipt/retry behavior, administrator login and settings. A lost connection during commit can make the outcome uncertain: keep writers stopped and perform a dry run with the proposed new key as `OLD_DATA_KEY` and a separate temporary test key as `NEW_DATA_KEY` to verify decryptability. Never guess or change the live key without verification.

For rollback while still offline, either restore the complete pre-rotation backup and its matching key, or run the same rotation with the keys reversed. Test the restored/reversed storage before restarting. Never restore an old snapshot over submissions received after the cutover without reconciliation. Rotation is an offline operation; there is no dual-key or zero-downtime mode.

### Rotate a development file store

```bash
node api/storage-cli.mjs rotate --source-dir /secure/old-data --output-dir /secure/new-data
node api/storage-cli.mjs rotate --source-dir /secure/old-data --output-dir /secure/new-data --apply --offline
```

`OLD_DATA_KEY` and `NEW_DATA_KEY` are required. The destination must not exist. Dry run creates nothing. Apply writes restricted staging files (directory 0700, files 0600), syncs them, and publishes the complete directory by rename. The old directory remains intact; an ordinary failure removes staging files. After a process crash, unreferenced `.roha-rotation-*` directories can be removed after confirming no rotation is running. If the command loses its connection/output after publication, inspect the destination before retrying. Point the stopped API’s `DATA_DIR` at the new directory and set `DATA_KEY` to the new key before restart. Preserve directory ownership/access for the API service account. File rotation preserves answer contents, including legacy fields; use the import policy above when migrating to PostgreSQL. File mode remains single-process development storage.

## Assistant language coverage

`schema/roha-copy-v1.json` is the source for English and Amharic assistant response templates: action feedback, voice states/errors, confirmations, orientation/resume/review, barrier explanations, AI service descriptions, resume messages and handoff feedback. Without an explicit SDK `language`, script `data-roha-language`, or element `language` setting, Roha follows the host document’s `lang`, including live page-language changes. An explicit language pins the assistant to that language; SDK callers can use `setLanguage()` to change it. Language changes update recognition, replies and labels while preserving text enlargement, confirmed answers and an unfinished typed request. Spoken Amharic uses `am-ET`; the same response is visible even if speech fails or is unavailable. Host-provided labels, names, answers, URLs and model identifiers retain their original text; the assistant does not translate user data. Developer diagnostics and operator CLI errors use stable English codes. Amharic content remains marked `am-draft-unreviewed` pending native-speaker and co-designer review. Availability and quality of actual speech recognition/synthesis depend on the browser/device.

## Monitoring and incident response

Authenticated `GET /api/admin/metrics` exposes per-worker request/failure/rejection/active counts without messages or keys. Aggregate them in your monitoring system; they reset on process restart. Monitor health, provider 429/502 responses, database connections/storage, submission latency, queue retries and backup age. The implementation does not provision an external monitoring account or alert destination.

If provider responses fail, disable AI in settings; local controls and forms remain usable. If a provider key is exposed, revoke it with the provider and replace it in settings. Sign-out revokes that session across replicas. For an administrator token incident, rotate `ROHA_ADMIN_TOKEN` and revoke all database sessions as a controlled incident action (`DELETE FROM roha_sessions`); changing the bootstrap token alone does not revoke existing sessions. Do not log request bodies, keys, utterances or answers.
## Guided form filling and approval

Choose **Help fill this form**, then say or type an answer. Roha displays the exact field and proposed value; with voice active it also reads the proposal aloud. Say **confirm** / **አረጋግጥ**, or use **Confirm this action**. Say **cancel** / **ሰርዝ**, use **Change it / cancel**, or provide a corrected answer. Nothing is filled until confirmed. For answers that contain command words, start with “answer”, for example “answer Read Services”.

Radio and select choices accept an exact displayed label, stored option value, or displayed choice number. Checkbox answers are confirmed individually, including consent. Roha cannot infer personal information, read a private profile from another service, or supply file/password fields. Personal answers in guided mode are handled locally and are not sent to the configured AI gateway. The browser speech service may process microphone audio, as described in the voice notice.

**Continue with Roha** / “next step” and **Previous step** / “go back” use the OpenPath wizard's own controls and validation. After moving forward, guided mode presents the new question. Correct or approve any pending answer before continuing. **Check answers** reads current visible field values; on the wizard's review screen it reads the host's complete review. It does not invent a separate saved profile.

The final send action requires its own confirmation after any consent checkbox. The preview is invalidated if the question, values, consent wording, availability or target changes. Approving twice cannot repeat the action. Generic embedded forms always require approval for their submit action. Delivery status and validation errors remain the host application's responsibility; Roha does not manufacture a receipt. It has no general-purpose delete, external sharing, operating-system or arbitrary button-click capability.

The SDK's `executeIntent(propose_answer)` and `executeIntent(request_submission)` now stage a proposal. A successful return means the proposal was accepted for user review, not that a field changed or a form was delivered. Adapters should preserve this distinction.
