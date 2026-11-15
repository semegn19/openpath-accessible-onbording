/**
 * Ollama AI Adapter
 * Self-hosted, local AI models (Ollama Whisper or multimodal audio models).
 * Default host: http://localhost:11434
 */
import { BaseAIProvider, normalizeMimeType, getLanguageName } from '../types.mjs';

export class OllamaProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'ollama',
      name: 'Ollama (Self-Hosted / Local LLM & ASR)',
      supportedLanguages: ['*'],
    });
  }

  isConfigured() {
    return Boolean(process.env.OLLAMA_HOST || process.env.AI_PROVIDER === 'ollama');
  }

  /**
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   */
  async transcribe({ audioBuffer, mimeType, lang }) {
    const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '');
    const model = process.env.OLLAMA_MODEL || 'whisper';
    const type = normalizeMimeType(mimeType);

    // Try OpenAI-compatible transcription endpoint on Ollama host first
    try {
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type }), 'speech.webm');
      form.append('model', model);
      if (lang && lang !== '*') form.append('language', lang);

      const res = await fetch(`${host}/v1/audio/transcriptions`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const text = String(data.text ?? data.transcription ?? '').trim();
        if (text) {
          return { text, engine: 'ollama', model, lang };
        }
      }
    } catch {
      // Fall through to multimodal generate endpoint
    }

    // Try Ollama native generate endpoint with base64 audio
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const langName = getLanguageName(lang);
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Transcribe this audio verbatim in ${langName}. Output only the transcribed text.`,
        images: [base64Audio], // Ollama accepts raw base64 media in images array
        stream: false,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Ollama returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
      err.status = 502;
      err.code = 'asr-failed';
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    const text = String(data.response ?? '').trim();
    if (!text) {
      const emptyErr = new Error('No speech was recognised in that recording.');
      emptyErr.code = 'no-speech';
      emptyErr.status = 422;
      throw emptyErr;
    }

    return {
      text,
      engine: 'ollama',
      model,
      lang,
    };
  }
}
