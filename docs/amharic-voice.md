# Amharic read-aloud: what to do about the voice

**Question:** the read-aloud works in English only. Do we need a free Amharic TTS, or pre-recorded
audio?
**Answer:** pre-recorded (or generated once at build time). Not because TTS is unavailable — because
the TTS that exists cannot be relied on at runtime, and the text that needs a voice is a *closed
set*.

---

## 1. Why the device voice cannot be the answer

`speechSynthesis` speaks whatever voice the operating system has installed. On the phone we are
building for:

| Platform | Amharic TTS | Evidence |
|---|---|---|
| Android (stock) | **No.** Google Text-to-Speech ships no Amharic voice. The only Android engine that lists Amharic is **eSpeak**, which the user must install themselves. | Organic Maps' own TTS FAQ lists Amharic → eSpeak only |
| iOS | No Amharic voice in the system list | — |
| Desktop Chrome/Firefox | Depends on OS voices; usually none | our own `speak()` already returns false |
| Android + eSpeak installed | Yes, robotic | not something we can require of a learner |

So today `speak('ስምዎን ይጻፉ', 'am')` returns `false` on the target device, and the UI honestly says
*"this device cannot read Amharic"*. Honest, and useless to the person who cannot read. **A
read-aloud feature that only works for the readers is not a read-aloud feature.**

---

## 2. The options, with the catches

| Option | Cost | Offline | Quality | Licence / catch |
|---|---|---|---|---|
| **Record it ourselves** (the native speaker on the team) | an afternoon | ✅ | best — right dialect, right register, human | none; the recording is ours |
| **Generate once, ship the audio** — OmniVoice Amharic (0.6B, Apache-2.0 weights, runs on a free Colab T4) | £0, a GPU-hour | ✅ (baked to files) | good; benchmarked, but not a human | **verify the licence before Savanna ships it commercially.** `african-low-resource/omnivoice-amharic` is published Apache-2.0; the sibling `OmniVoice-Africa` card says **CC-BY-NC-4.0** (non-commercial). Do not put NC output in a commercial deployment without asking. |
| **eSpeak NG at build time** | £0 | ✅ | robotic; Amharic G2P is the weak point — test before committing | **GPLv3.** Generating files with it is fine; **linking the binary or bundling a WASM build into our app is not** without accepting GPL on the whole bundle |
| **eSpeak NG in the browser** | £0 | ✅ | robotic | same GPL problem, plus a ~2 MB WASM download on a 3G phone |
| **Paid cloud TTS** (Google/Azure/Amazon) | per character | ❌ | good | breaks two promises at once: no paid API lock-in, and no runtime third-party request |
| **Do nothing, show the text** | £0 | ✅ | — | what happens today, and it is why you asked |

**Nothing in that table is a runtime dependency.** Every viable row produces *files at build time*,
which is the only shape that survives a 3G phone with no signal.

---

## 3. Why "pre-recorded" is not a hack here

Pre-recorded audio usually means a stale, brittle copy of the text. It is safe in this product
because the spoken text is a **closed set generated from the schema**:

```
79 Amharic strings  (33 learner · 22 job · 24 employer)
+ 79 English strings
= 158 clips, ~1.5 MB at 32 kbit/s mono AAC — less than the Ethiopic font
```

Every one of them is a `label`, `legend`, `hint`, `body` or option label. They cannot drift,
because `npm run audio` derives the file names from the strings themselves: change a question in
the schema and the old clip becomes an orphan the script tells you to delete, while the new string
shows up in the recording list. The build fails loud rather than playing the wrong sentence.

**Dynamic text** — a name or a phone number read back on the review screen — cannot be recorded.
That is the one place the device voice is used, and when there is none the screen says so. This is
the right split: 90 % of what a low-literacy person needs to *hear* is static; the answers are
already on screen in front of them.

---

## 4. How it is wired (already done)

| Piece | Where | What it does |
|---|---|---|
| `playRecorded(lang, text)` | `src/audio.ts` | looks up `public/audio/index.json` by `FNV-1a("<lang>|<text>")`, plays the file; `false` if absent |
| `ReadAloudButton` | `src/speech.tsx` | **recorded → device voice → honest message**, in that order |
| Keypress cancels | `useCancelSpeechOnKey` | stops a recording as well as TTS (the gate requires sound-off to be easy) |
| `npm run audio` | `scripts/audio-manifest.mjs` | writes `public/audio/index.json`, generates `docs/audio-recording-list.md`, flags orphans |
| Offline | `public/sw.js` | audio is served from the cache like any other asset, so a recorded read-aloud works with no signal |

**Recording format:** m4a (AAC), mono, 32 kbit/s — the one format every phone plays including iOS.
`ffmpeg -i in.wav -c:a aac -b:a 32k -ac 1 out.m4a`. Roughly 4 KB per second; a 10-second question
is 40 KB, and only the current screen's clips are fetched.

---

## 5. What to do, in order

| # | Action | Time | Owner |
|---|---|---|---|
| 1 | **Record the learner form** — 33 Amharic clips: intro, 10 questions, 5 hints, the consent statements, 6 identity options. This is the form the gate judges | 1.5 h | the native speaker |
| 2 | Drop the files in `app/public/audio/`, run `npm run audio`, commit | 5 min | any dev |
| 3 | Job and employer forms — 46 clips | 2 h | the native speaker, if there is time |
| 4 | *(Only if recording is impossible)* generate all 158 with OmniVoice Amharic on a free Colab T4 at build time; keep the model, the seed and the commit hash in the repo so the audio is reproducible | 1 h + review | a dev, with the licence check |
| 5 | English clips last — the device voice already works in English, so they are a quality upgrade, not a fix | — | — |

`docs/audio-recording-list.md` is generated and lists exactly the file names, languages and texts.
It is the recording script: read down the page.

---

## 6. What we will not do, and why

- **No paid TTS API at runtime.** It would fail on the offline test, add a per-learner cost to an
  organisation with no budget, and hand our learners' question text to a third party.
- **No bundling eSpeak NG into the app.** GPLv3 on the bundle is a licence decision nobody has
  time to make this weekend; build-time generation keeps it on the right side of the line.
- **No CC-BY-NC model output in anything Savanna runs commercially** without a written answer.
  Fine for a hackathon demo; ask before December.
- **No reading personal answers aloud through a cloud service.** The review read-back stays on the
  device. A name is exactly the thing that must not leave it.

---

## 7. The honest summary for a judge

> Read-aloud works in English everywhere and in Amharic through 158 pre-recorded clips — because
> the phone cannot speak Amharic. We did not add a paid API to fix that: we shipped the sound, at
> 1.5 MB, offline, with no third-party request at runtime, and it degrades to an explicit message
> rather than silence.
