/**
 * OpenAI-Compatible Speech-to-Text Adapter
 * Compatible with OpenAI Audio API, Groq Whisper, Cloudflare Whisper, vLLM, and whisper.cpp HTTP servers.
 */
import { BaseAIProvider, normalizeMimeType } from '../types.mjs';

export class OpenAICompatibleProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'openai-compatible',
      name: 'OpenAI-Compatible (Whisper / Groq / vLLM)',
      supportedLanguages: ['*'],
    });
  }

  isConfigured() {
    return Boolean(process.env.ASR_URL || process.env.OPENAI_API_KEY);
  }

  /**
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   */
  async transcribe({ audioBuffer, mimeType, lang }) {
    const rawUrl = process.env.ASR_URL;
    const apiKey = process.env.ASR_KEY || process.env.OPENAI_API_KEY || '';
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const targetUrl = rawUrl || `${baseUrl.replace(/\/+$/, '')}/audio/transcriptions`;
    const model = process.env.ASR_MODEL || 'whisper-1';

    const type = normalizeMimeType(mimeType);
    const form = new FormData();
    const filename = type.includes('wav') ? 'speech.wav' : type.includes('ogg') ? 'speech.ogg' : 'speech.webm';
    form.append('file', new Blob([audioBuffer], { type }), filename);
    form.append('model', model);
    if (lang && lang !== '*') {
      form.append('language', lang);
    }

    const headers = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Upstream speech engine returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
      err.status = 502;
      err.code = 'asr-failed';
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    const text = String(data.text ?? data.transcription ?? '').trim();
    if (!text) {
      const emptyErr = new Error('No speech was recognised in that recording.');
      emptyErr.code = 'no-speech';
      emptyErr.status = 422;
      throw emptyErr;
    }

    return {
      text,
      engine: data.engine ?? 'openai-compatible',
      lang,
    };
  }
}
