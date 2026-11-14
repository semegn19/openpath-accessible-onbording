# Generating audio with the adopter's own key — design

**Your plan:** record the shipped forms by hand; if an adopter adds a question, they generate that
one clip once with a paid key; from then on it is played like any other recording.
**Verdict: yes, and it is the right shape.** It keeps the runtime free, offline and private, and it
moves the only paid call to a moment when a human is already editing a form and can wait for it.

**Does it need a database? No.** The cache key is the content itself. Details in §3.

---

## 1. Why this shape works

| Property | Why it holds |
|---|---|
| Pay once per string, not once per learner | A clip is written when a question is added, then served as a static file forever |
| No runtime third-party request | The browser fetches `/audio/<id>.opus` from our own origin; `npm run hosts` stays green |
| Works offline | The service worker caches audio like any other asset — a read-aloud with no signal |
| No key in the browser | Generation runs in a CLI, server-side. A key in a bundle is a key on the internet |
| No drift between words and sound | Clip id = `FNV-1a("<lang>|<text>")`. Change the text and it is a *different* clip; the old one is reported as an orphan and the new one appears on the recording list |
| Never pays twice | 158 strings → 141 clips: identical strings across forms collapse to one file |

Already implemented and tested (`npm run audio:generate`, `tests/audio.mjs`, 12 assertions):

```bash
npm run audio:generate                                  # dry run, default: prints what and how much
npm run audio:generate -- --provider=fake --write        # proves the pipeline, no key, no cost
TTS_API_KEY=… npm run audio:generate -- --provider=openai --write --limit-chars=20000
```

Guards that exist today: dry run by default, `--write` required, `--limit-chars` cap refused
before spending, missing-key refusal, per-clip provenance (`provider`, `voice`, `when`), and a stop
at the first failure so a half-finished run is resumable.

---

## 2. What the adopter's flow looks like

```
1. adopter edits schema/my-form.json          → adds a question
2. npm run validate                            → 0 errors (W11-style content warnings still apply)
3. npm run audio:generate                      → "3 strings missing, 412 characters, $0.006"
4. npm run audio:generate -- --provider=… --write
                                               → 3 files + index.json + provenance.json
5. commit, deploy                              → the app plays them; nothing calls the provider
```

Step 3 is the important one: **the price is shown before it is paid**, in characters and dollars,
for the diff only. An adopter adding one question pays for one question.

For a non-technical adopter, that becomes one button in an admin page — the same script behind an
endpoint (`POST /api/admin/audio/generate`), key held server-side. That is a small addition, not a
new architecture. See `docs/backlog.md` AUDIO-3.

---

## 3. "Will it need a database?" — no, and here is what replaces one

The database question is really "where does the cache live and how do we find a clip again". The
answer is a **content-addressed file store**: the file name *is* the lookup key.

| Deployment | Storage | DB needed? |
|---|---|---|
| **Shipped forms (today)** | `app/public/audio/*.opus` + `index.json`, in the repo, served as static files | **No.** Git is the store; `index.json` is the index. |
| Savanna-hosted, several partners | `audio/<formId>/*.opus` + one `index.json` per form | **No.** One directory per tenant. |
| Many sites, audio must not live in the repo | S3-compatible bucket (MinIO, R2) keyed by the same id | **No.** The object key replaces the file name. |
| Adopter clicks "generate" in an admin UI | Files + `jobs.jsonl` (append-only, like `submissions.jsonl`) | **No** for a single instance. **SQLite** (one file) becomes worth it only if you need a retry queue with status across restarts, or per-key spend accounting. |

**When a real database would earn its place:** multi-tenant billing (who spent what), generation
audit for a compliance review, or serving audio from a read-only container. Even then it is SQLite,
not Postgres — this app takes one form submission at a time.

**What we already do that fits:** `api/server.mjs` writes append-only JSONL and rebuilds state at
boot. An audio generation log is the same pattern — `provenance.json` is that log, per file.

---

## 4. The problems this design will hit, and the answer for each

| Problem | Answer |
|---|---|
| **Mixed voices.** Hand-recorded clips and generated clips in the same form sound like two different people. | `provenance.json` records the source per clip, so a mismatch is visible at build time. Rule: **one voice per form** — if a form has any generated clip, generate the whole form with the same provider+voice rather than mixing. |
| **A paid provider changes its voice or model** and the regenerated clip no longer matches the old ones. | Provenance stores `provider`, `model`, `voice`, `at`. Regenerating a single string after a voice change is detectable; regenerate the form. |
| **Cost growth.** | Dedupe by content, per-run cap, dry run first, and a committed `provenance.json` so the spend is auditable. Strings are short: the whole Amharic set is ~7 500 characters — cents, not dollars. |
| **Licence of generated audio.** | Provider terms govern the output, not the code. Check the provider allows the use you need (commercial, offline redistribution) **before** committing the files — the files travel with the repo forever. |
| **A key pasted into a browser "generate" button.** | Never. Generation is server-side; the browser only ever sees the resulting file. |
| **Someone deletes a clip and the form goes silent.** | `audio-manifest.mjs` reports coverage on every run; `npm run audio --list` shows what is missing; the app falls back to the device voice and then to an explicit message, never to silence. |

---

## 5. The provider adapters (the only work left)

`scripts/audio-generate.mjs` has one implemented adapter (`openai`) and one stub that throws. Each
adapter is ~30 lines with the same shape:

```js
async function synthesize(text, lang) → Buffer
```

| Provider | Endpoint | Notes |
|---|---|---|
| OpenAI | `POST /v1/audio/speech` | implemented; `response_format: opus` |
| Azure Speech | `POST /cognitiveservices/v1` with SSML | SSML gives control over rate — worth it for low-literacy listeners |
| ElevenLabs | `POST /v1/text-to-speech/{voice}` | best quality, ~10× the price |
| Self-hosted OmniVoice / Piper | local HTTP or direct inference | **best fit for Savanna**: no per-character cost at all, no third party. See `docs/amharic-voice.md` |

**Recommendation for Savanna specifically:** run OmniVoice Amharic on their own box and point the
adapter at it. Then "generate once with a paid key" becomes "generate once on our own GPU", the
cost is zero per string, and the licence question (Apache-2.0 weights) is answerable.

---

## 6. About the STT key you mentioned — one caution

A paid **speech-to-text** key is a different animal from this design, because STT is called *at
runtime, per learner*:

- **It cannot live in the browser.** Anything shipped to the client is public; an STT key in the
  bundle is an open account. It must go through our API (`POST /api/transcribe`), which means the
  learner's **voice recording leaves the device** — the exact thing our privacy story says does not
  happen.
- That breaks two rubric lines at once: *no paid-API lock-in* (15 points, "can be kept running")
  and *privacy* (15 points), and it contradicts the leaflet copy on the consent screens.
- **Cheaper and safer:** keep the browser's own `SpeechRecognition` (free, already implemented,
  already reviewable by the user before it fills a field), or self-host a small model
  (`whisper.cpp` on the same box as OmniVoice). Self-hosting keeps audio on infrastructure Savanna
  controls, which is a sentence they can defend.

**What we actually built (v1.3.0).** The caution above is answered rather than ignored:

- `POST /api/transcribe` exists, is **off unless an operator turns it on** (`ASR_URL`, `ASR_KEY`,
  `ASR_MODEL`), and is OpenAI-compatible multipart — so `whisper.cpp`'s `/inference` on the same box
  as OmniVoice works, as does any hosted provider if an adopter prefers one key over a GPU.
- **No key ever reaches the browser.** The client only calls our own endpoint.
- **Audio is never stored.** It is read into memory, forwarded, and dropped; the log records the
  byte length, never the content. (Same discipline as `audio.mjs`: temp files, then deleted.)
- **The learner is told before recording starts,** in both languages: *"Your voice is sent to this
  server only to be written down, then deleted."* The recording card shows it while it runs.
- The mic still never appears on the ID-number field or on consent screens (`E22`/`E26`, and
  `controls.mjs` checks it), so the sensitive value is never the one going over the wire.
- With `ASR_URL` unset the UI says so plainly instead of pretending: *"This server also has no
  transcription service configured, so there is nothing to fall back on."*

If a **paid** provider is chosen anyway: one key for the deployment, disclosed as above, and never
per learner. That is the deployment's decision, not the learner's — which keeps the 15-point
"can be kept running" line intact, because the form still works with the mic switched off.

`GET /api/health` reports `transcription: "configured" | "none"`, so an adopter can verify what
they deployed in one request. `tests/transcribe.mjs` runs the whole path against a fake engine.
