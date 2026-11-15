/**
 * Addis AI Adapter
 * Native speech-to-text and text-to-speech for Ethiopian languages (Amharic, Afaan Oromo, Tigrinya).
 * Docs: https://docs.addisassistant.com/
 */
import { BaseAIProvider, normalizeMimeType } from '../types.mjs';

export class AddisAIProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'addis-ai',
      name: 'Addis AI (Ethiopian low-resource ASR & TTS)',
      supportedLanguages: ['am', 'om', 'ti'],
    });
  }

  isConfigured() {
    return Boolean(process.env.ADDIS_AI_API_KEY);
  }

  /**
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   */
  async transcribe({ audioBuffer, mimeType, lang }) {
    const apiKey = process.env.ADDIS_AI_API_KEY;
    if (!apiKey) {
      throw new Error('ADDIS_AI_API_KEY is not set in environment.');
    }

    const normLang = String(lang || 'am').toLowerCase().trim();
    if (!this.supportsLanguage(normLang)) {
      throw new Error(`Addis AI does not support language: ${normLang}. Supported: am, om, ti`);
    }

    const type = normalizeMimeType(mimeType);
    const form = new FormData();
    const filename = type.includes('wav') ? 'speech.wav' : type.includes('ogg') ? 'speech.ogg' : 'speech.webm';
    form.append('audio', new Blob([audioBuffer], { type }), filename);
    form.append('request_data', JSON.stringify({ language_code: normLang }));

    const res = await fetch('https://api.addisassistant.com/api/v2/stt', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: form,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Addis AI STT returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
      err.status = res.status;
      err.code = 'asr-upstream-error';
      throw err;
    }

    const data = await res.json().catch(() => ({}));
    const text = String(data?.data?.transcription ?? '').trim();
    if (!text) {
      const emptyErr = new Error('No speech was recognised in that recording.');
      emptyErr.code = 'no-speech';
      emptyErr.status = 422;
      throw emptyErr;
    }

    return {
      text,
      engine: 'addis-ai',
      lang: normLang,
    };
  }

  /**
   * Synthesize speech using Addis AI TTS API.
   * @param {Object} params
   * @param {string} params.text
   * @param {string} params.lang
   */
  async synthesize({ text, lang }) {
    const apiKey = process.env.ADDIS_AI_API_KEY;
    if (!apiKey) throw new Error('ADDIS_AI_API_KEY is not set in environment.');

    const normLang = String(lang || 'am').toLowerCase().trim();
    const res = await fetch('https://api.addisassistant.com/api/v1/tts', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        language_code: normLang,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Addis AI TTS HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return {
      audioBuffer: Buffer.from(arrayBuf),
      mimeType: 'audio/mpeg',
    };
  }
}
