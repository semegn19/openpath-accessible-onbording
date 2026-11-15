/**
 * Mock AI Provider
 * Deterministic, offline provider for automated testing and CI.
 */
import { BaseAIProvider } from '../types.mjs';

export class MockAIProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'mock',
      name: 'Mock Speech Engine (Offline Test)',
      supportedLanguages: ['*'],
    });
  }

  isConfigured() {
    return process.env.AI_PROVIDER === 'mock' || process.env.NODE_ENV === 'test';
  }

  /**
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   */
  async transcribe({ audioBuffer, lang }) {
    const bytes = audioBuffer?.length ?? 0;
    // Mimic fake whisper behavior: oversized or silent audio returns no speech
    if (bytes > 500_000 || bytes === 0) {
      const err = new Error('No speech was recognised in that recording.');
      err.code = 'no-speech';
      err.status = 422;
      throw err;
    }

    const normLang = String(lang || 'am').toLowerCase().trim();
    let text = 'ሳራ በቀለ';
    if (normLang === 'om') text = 'Caaltuu Dheeressa';
    else if (normLang === 'ti') text = 'ሳራ ተስፋይ';
    else if (normLang === 'en') text = 'Sara Bekele';

    return {
      text,
      engine: 'mock',
      lang: normLang,
    };
  }
}
