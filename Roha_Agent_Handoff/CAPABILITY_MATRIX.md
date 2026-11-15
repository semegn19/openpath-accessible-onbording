# Roha Capability Matrix

**Version:** 2.0 | **Tested Date:** 14 November 2026 | **Build Hash:** 51934b02b7e219ff9c089a09507404b4ddb2633e

## 1. Language Capability Inventory

| Language | Tag | UI Translation | Commands | Transcription (ASR) | Dynamic TTS | Spoken Prompts | Wake Detection ("Hey Roha") |
|---|---|---|---|---|---|---|---|
| **English** | `en` | ✅ Verified (`app/src/roha/i18n`) | ✅ Verified (`app/src/roha/router.ts`) | ⚠️ Partial (Web Speech / faster-whisper) | ✅ Verified (Browser SpeechSynthesis) | ✅ Verified (`app/public/audio`) | ❌ Unavailable (Model in training; tap active) |
| **Amharic** | `am` | ✅ Verified (`schema/runtime-copy-v1.json`) | ⚠️ Partial (Local rule templates) | ⚠️ Partial (Web Speech `am-ET`) | ⚠️ Partial (System voice dependent) | ✅ Verified (Licensed prompts) | ❌ Unavailable (Planned post-hackathon) |
| **Tigrinya** | `ti` | 🔲 Planned (Copy in review) | 🔲 Planned (Rule table prep) | ❌ Unavailable (Whisper lacks coverage) | ❌ Unavailable (No standard browser voice) | 🔲 Planned (Talent recording scheduled) | ❌ Unavailable (Not trained) |
| **Afaan Oromo** | `om` | 🔲 Planned (Copy in review) | 🔲 Planned (Rule table prep) | ❌ Unavailable (Whisper lacks coverage) | ❌ Unavailable (No standard browser voice) | 🔲 Planned (Scheduled) | ❌ Unavailable (Not trained) |

## 2. Runtime Profile Matrix

| Profile | Network Requirement | Offline Ready | Model Dependencies | Test Evidence |
|---|---|---|---|---|
| **device-local** (default) | None (zero outbound calls) | ✅ Yes | In-browser rules + Web Speech + local cache | Verified with internet disconnected; `dist/roha.js` operates locally |
| **local-hub** | Local Network (LAN) | ✅ Yes (LAN only) | Optional local faster-whisper / Ollama daemon | Tested via REST contracts; requires reachable LAN server |
| **remote-opt-in** | Internet connectivity | ❌ No | Optional remote transcription with learner consent | Outlined in `openapi.json`; requires explicit opt-in |

## 3. Platform & Browser Verification Matrix

| OS / Platform | Browser | Status | Discovery | Text Scaling | Local Commands | Voice |
|---|---|---|---|---|---|---|
| **Linux (x86_64)** | Chromium / Chrome | ✅ Verified | ✅ Passed | ✅ Passed | ✅ Passed | ⚠️ Browser Speech API / Web Speech |
| **Windows 11** | Edge / Chrome | ⚠️ Equivalent engine | 🔲 Pending field test | 🔲 Pending | 🔲 Pending | 🔲 Pending |
| **macOS** | Safari / Chrome | ⚠️ Partial | 🔲 Pending | 🔲 Pending | 🔲 Pending | 🔲 Safari Speech limits |
| **Android (3G)** | Chrome Mobile | ⚠️ Partial | 🔲 Responsive verified | 🔲 Verified via reflow | 🔲 Passed | ⚠️ Web Speech dependent |
| **iOS** | Mobile Safari | 🔲 Not tested | 🔲 Untested | 🔲 Untested | 🔲 Untested | 🔲 Untested |

