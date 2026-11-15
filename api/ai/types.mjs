/**
 * OpenPath AI Provider Abstraction
 * Unified contract for Speech-to-Text (STT) and Text-to-Speech (TTS).
 */

export const LANGUAGE_NAMES = {
  am: 'Amharic',
  om: 'Afaan Oromo',
  ti: 'Tigrinya',
  en: 'English',
};

export function getLanguageName(code) {
  const norm = String(code || '').toLowerCase().trim();
  return LANGUAGE_NAMES[norm] || norm || 'Amharic';
}

export function normalizeMimeType(type) {
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  if (t === 'audio/webm' || t === 'audio/ogg' || t === 'audio/wav' || t === 'audio/mp4' || t === 'audio/mp3' || t === 'audio/mpeg') {
    return t;
  }
  return 'audio/webm';
}

export class BaseAIProvider {
  /**
   * @param {Object} options
   * @param {string} options.id - e.g. 'addis-ai', 'gemini', 'ollama', 'openai-compatible', 'mock'
   * @param {string} options.name - Human-readable label
   * @param {string[]} options.supportedLanguages - e.g. ['am', 'om', 'ti'] or ['*']
   */
  constructor({ id, name, supportedLanguages = ['*'] }) {
    this.id = id;
    this.name = name;
    this.supportedLanguages = supportedLanguages;
  }

  /**
   * Checks whether the provider is configured and ready in the current environment.
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }

  /**
   * Checks if this provider supports the given language code.
   * @param {string} langCode - 'am', 'om', 'ti', 'en', etc.
   * @returns {boolean}
   */
  supportsLanguage(langCode) {
    if (this.supportedLanguages.includes('*')) return true;
    const norm = String(langCode || '').toLowerCase().trim();
    return this.supportedLanguages.includes(norm);
  }

  /**
   * Transcribe an audio recording to text.
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer - Raw binary audio
   * @param {string} params.mimeType - e.g. 'audio/webm', 'audio/wav', 'audio/mp3'
   * @param {string} params.lang - Language code ('am', 'om', 'ti', 'en')
   * @returns {Promise<{ text: string, engine: string, lang?: string, model?: string }>}
   */
  async transcribe({ audioBuffer, mimeType, lang }) {
    throw new Error(`transcribe() not implemented by ${this.id}`);
  }

  /**
   * Synthesize text to speech (optional).
   * @param {Object} params
   * @param {string} params.text
   * @param {string} params.lang
   * @param {string} [params.voice]
   * @returns {Promise<{ audioBuffer: Buffer, mimeType: string }>}
   */
  async synthesize({ text, lang, voice }) {
    throw new Error(`synthesize() not implemented by ${this.id}`);
  }
}
