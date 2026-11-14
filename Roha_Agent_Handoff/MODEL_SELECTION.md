# Roha provider selection worksheet

These are candidates from the planning conversation, not installed or benchmarked dependencies. Verify current official documentation/model cards, platform support, licences and exact target-language inventory before selection. Do not treat any listed candidate as already validated.

| Function | Candidate path | Required decision evidence |
| --- | --- | --- |
| Essential commands | Local phrase/intent rules and reviewed templates | Correctness without an LLM; language-specific phrases reviewed by speakers |
| Flexible conversation | Local Qwen3-4B-Instruct through an appropriate runtime | Setup time, structured-output behaviour, RAM, latency, language quality and licence |
| English/Amharic ASR | Local faster-whisper with an appropriate multilingual model | Real recordings, error/correction rate, device latency and offline readiness |
| Additional ASR | omniASR-CTC-300M or another verified permissive candidate | Exact language codes, real target-language accuracy, installation/platform and memory |
| Research ASR/TTS alternative | Relevant MMS checkpoints | Restrictive licence review; do not silently ship as an unrestricted commercial dependency |
| Read-aloud | Available offline system voice or a separately validated engine | Voice installation, actual arbitrary-content coverage, latency and quality |
| Fixed spoken questions | Licensed native-speaker recordings | Native review, correct meaning, size and offline playback; not general TTS |
| Wake | Tested foreground recogniser first; dedicated keyword detector later | Phrase training/configuration, accent/noise misses, false activations, battery and licence |

Useful primary starting points:
- https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- https://github.com/SYSTRAN/faster-whisper
- https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
- https://huggingface.co/facebook/omniASR-CTC-300M
- https://github.com/dscripka/openWakeWord
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

Do not assume that browser speech is uniformly available or offline, that standard Whisper covers all four languages, that a renamed wake detector recognises Roha, or that a server GPU benchmark establishes low-cost-phone performance. Node/Python local inference and browser-only inference are different deployment profiles.

## Record for the chosen provider

Model/version/checksum:
Official source and licence:
Device/OS/browser/runtime:
Language/capability:
Initial download and installed footprint:
RAM/CPU/GPU requirements:
Cold/warm latency and utterance duration:
Real-recording task success and manual corrections:
Actual offline test:
Data sent outside device and consent:
Failure behaviour:
Decision: selected / rejected / not tested, with reason.
