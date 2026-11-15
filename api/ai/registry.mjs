/**
 * OpenPath AI Registry
 * Central orchestrator for speech-to-text and text-to-speech providers.
 * Allows seamless switching between Addis AI, Google Gemini, Ollama, OpenAI-compatible, and Mock engines.
 */
import { AddisAIProvider } from './providers/addis-ai.mjs';
import { GeminiAIProvider } from './providers/gemini.mjs';
import { OpenAICompatibleProvider } from './providers/openai-compatible.mjs';
import { OllamaProvider } from './providers/ollama.mjs';
import { MockAIProvider } from './providers/mock.mjs';

export class AIRegistry {
  constructor() {
    this.providers = new Map();

    // Register built-in providers
    this.register(new AddisAIProvider());
    this.register(new GeminiAIProvider());
    this.register(new OpenAICompatibleProvider());
    this.register(new OllamaProvider());
    this.register(new MockAIProvider());
  }

  /**
   * Register a new AI provider instance.
   * @param {import('./types.mjs').BaseAIProvider} provider
   */
  register(provider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Get provider by ID.
   * @param {string} id
   * @returns {import('./types.mjs').BaseAIProvider|undefined}
   */
  getProvider(id) {
    return this.providers.get(id);
  }

  /**
   * List all providers with their current configuration status.
   */
  listProviders() {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      configured: p.isConfigured(),
      supportedLanguages: p.supportedLanguages,
    }));
  }

  /**
   * Get all currently configured providers.
   */
  getConfiguredProviders() {
    return Array.from(this.providers.values()).filter((p) => p.isConfigured());
  }

  /**
   * Whether any ASR provider is active and configured.
   * @returns {boolean}
   */
  isConfigured() {
    return this.getConfiguredProviders().length > 0;
  }

  /**
   * Get unique list of languages supported by currently configured providers.
   * @returns {string[]}
   */
  getSupportedLanguages() {
    const langs = new Set();
    for (const p of this.getConfiguredProviders()) {
      if (p.supportedLanguages.includes('*')) {
        langs.add('am');
        langs.add('om');
        langs.add('ti');
        langs.add('en');
      } else {
        for (const l of p.supportedLanguages) langs.add(l);
      }
    }
    return Array.from(langs);
  }

  /**
   * Resolve the best provider for a given language and preference.
   * @param {Object} options
   * @param {string} [options.lang='am']
   * @param {string} [options.preferredProvider]
   * @returns {import('./types.mjs').BaseAIProvider|null}
   */
  resolveProvider({ lang = 'am', preferredProvider = '' } = {}) {
    const configured = this.getConfiguredProviders();
    if (!configured.length) return null;

    const normLang = String(lang || 'am').toLowerCase().trim();
    const explicitId = preferredProvider || process.env.AI_PROVIDER || '';

    // 1. Explicit provider requested
    if (explicitId && explicitId !== 'auto') {
      const explicit = this.getProvider(explicitId);
      if (explicit && explicit.isConfigured() && explicit.supportsLanguage(normLang)) {
        return explicit;
      }
    }

    // 2. Auto selection based on language capabilities
    const isEthiopian = ['am', 'om', 'ti'].includes(normLang);

    if (isEthiopian) {
      // Priority 1: Addis AI (specialized for Ethiopian speech models)
      const addis = this.getProvider('addis-ai');
      if (addis && addis.isConfigured() && addis.supportsLanguage(normLang)) return addis;

      // Priority 2: Gemini (high quality multilingual multimodal)
      const gemini = this.getProvider('gemini');
      if (gemini && gemini.isConfigured() && gemini.supportsLanguage(normLang)) return gemini;

      // Priority 3: OpenAI-compatible / ASR_URL
      const openai = this.getProvider('openai-compatible');
      if (openai && openai.isConfigured()) return openai;

      // Priority 4: Ollama
      const ollama = this.getProvider('ollama');
      if (ollama && ollama.isConfigured()) return ollama;

      // Priority 5: Mock
      const mock = this.getProvider('mock');
      if (mock && mock.isConfigured()) return mock;
    } else {
      // Non-Ethiopian language (e.g. English)
      // Addis AI explicitly does not transcribe English, so skip Addis AI

      // Priority 1: Gemini
      const gemini = this.getProvider('gemini');
      if (gemini && gemini.isConfigured()) return gemini;

      // Priority 2: OpenAI-compatible / ASR_URL
      const openai = this.getProvider('openai-compatible');
      if (openai && openai.isConfigured()) return openai;

      // Priority 3: Ollama
      const ollama = this.getProvider('ollama');
      if (ollama && ollama.isConfigured()) return ollama;

      // Priority 4: Mock
      const mock = this.getProvider('mock');
      if (mock && mock.isConfigured()) return mock;
    }

    // Fallback: any configured provider that supports the language
    return configured.find((p) => p.supportsLanguage(normLang)) || null;
  }

  /**
   * Transcribe audio with automatic provider resolution and fallback.
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   * @param {string} [params.preferredProvider]
   */
  async transcribe({ audioBuffer, mimeType, lang = 'am', preferredProvider = '' }) {
    if (!this.isConfigured()) {
      const err = new Error('Speech-to-text is not configured on this server.');
      err.code = 'asr-not-configured';
      err.status = 503;
      throw err;
    }

    const normLang = String(lang || 'am').toLowerCase().trim();
    const primary = this.resolveProvider({ lang: normLang, preferredProvider });

    if (!primary) {
      const err = new Error(`No speech engine available for language: ${normLang}`);
      err.code = 'language-not-supported';
      err.status = 422;
      throw err;
    }

    try {
      return await primary.transcribe({ audioBuffer, mimeType, lang: normLang });
    } catch (err) {
      // If error is legitimate speech detection issue (e.g. empty audio), do not retry
      if (err.code === 'no-speech' || err.status === 422) {
        throw err;
      }

      // Try fallback to another configured provider if available
      const configured = this.getConfiguredProviders();
      const fallbacks = configured.filter((p) => p.id !== primary.id && p.supportsLanguage(normLang));

      for (const fallback of fallbacks) {
        try {
          console.warn(`[AI Registry] Primary provider ${primary.id} failed (${err.message}). Falling back to ${fallback.id}...`);
          return await fallback.transcribe({ audioBuffer, mimeType, lang: normLang });
        } catch {
          // Continue to next fallback
        }
      }

      throw err;
    }
  }

  /**
   * Synthesize text to speech.
   * @param {Object} params
   * @param {string} params.text
   * @param {string} params.lang
   */
  async synthesize({ text, lang = 'am' }) {
    const normLang = String(lang || 'am').toLowerCase().trim();
    const addis = this.getProvider('addis-ai');
    if (addis && addis.isConfigured() && addis.supportsLanguage(normLang)) {
      return await addis.synthesize({ text, lang: normLang });
    }
    throw new Error(`Text-to-speech not supported for language: ${normLang}`);
  }
}

export const aiRegistry = new AIRegistry();
