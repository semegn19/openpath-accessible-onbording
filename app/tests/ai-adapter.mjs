/**
 * AI Multi-Provider Adapter Contract Tests
 * Verifies that the AI adapter architecture correctly:
 * 1. Discovers and configures Addis AI, Gemini, Ollama, OpenAI-compatible, and Mock providers.
 * 2. Routes Ethiopian languages (am, om, ti) to Addis AI or Gemini.
 * 3. Routes English (en) to Gemini or OpenAI-compatible (never Addis AI).
 * 4. Honors explicit provider preference (?provider=gemini or x-ai-provider).
 * 5. Falls back cleanly across providers when upstream errors occur.
 * 6. Handles offline Mock provider deterministically.
 */
import { AIRegistry } from '../../api/ai/registry.mjs';
import { MockAIProvider } from '../../api/ai/providers/mock.mjs';
import { BaseAIProvider } from '../../api/ai/types.mjs';

let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

console.log('\n--- 1. Provider Discovery & Registration ---');
{
  const registry = new AIRegistry();
  const list = registry.listProviders();
  ok(list.length === 5, 'registers all 5 standard providers', `count: ${list.length}`);
  const ids = list.map((p) => p.id);
  ok(ids.includes('addis-ai'), 'includes addis-ai');
  ok(ids.includes('gemini'), 'includes gemini');
  ok(ids.includes('openai-compatible'), 'includes openai-compatible');
  ok(ids.includes('ollama'), 'includes ollama');
  ok(ids.includes('mock'), 'includes mock');
}

console.log('\n--- 2. Language Routing & Provider Resolution ---');
{
  const registry = new AIRegistry();

  // Test scenario A: Both Addis AI and Gemini configured
  process.env.ADDIS_AI_API_KEY = 'mock_addis_key';
  process.env.GEMINI_API_KEY = 'mock_gemini_key';
  process.env.AI_PROVIDER = 'auto';

  const amharicProvider = registry.resolveProvider({ lang: 'am' });
  ok(amharicProvider?.id === 'addis-ai', 'Amharic routes to Addis AI when both Addis AI and Gemini are configured');

  const oromoProvider = registry.resolveProvider({ lang: 'om' });
  ok(oromoProvider?.id === 'addis-ai', 'Afaan Oromo routes to Addis AI');

  const tigrinyaProvider = registry.resolveProvider({ lang: 'ti' });
  ok(tigrinyaProvider?.id === 'addis-ai', 'Tigrinya routes to Addis AI');

  const englishProvider = registry.resolveProvider({ lang: 'en' });
  ok(englishProvider?.id === 'gemini', 'English routes to Gemini (Addis AI does not transcribe English)');

  // Test scenario B: Explicit provider preference requested
  const explicitGemini = registry.resolveProvider({ lang: 'am', preferredProvider: 'gemini' });
  ok(explicitGemini?.id === 'gemini', 'Explicit ?provider=gemini overrides auto-routing for Amharic');

  // Test scenario C: Only Gemini configured (Addis AI unconfigured)
  delete process.env.ADDIS_AI_API_KEY;
  const amharicWithGemini = registry.resolveProvider({ lang: 'am' });
  ok(amharicWithGemini?.id === 'gemini', 'Amharic falls back to Gemini when Addis AI is unset');

  // Test scenario D: Only OpenAI configured
  delete process.env.GEMINI_API_KEY;
  process.env.ASR_URL = 'http://localhost:8000/v1/audio/transcriptions';
  const amharicWithOpenAI = registry.resolveProvider({ lang: 'am' });
  ok(amharicWithOpenAI?.id === 'openai-compatible', 'Amharic routes to OpenAI-compatible when only ASR_URL is set');
  delete process.env.ASR_URL;
}

console.log('\n--- 3. Mock Provider Deterministic Operation ---');
{
  const mock = new MockAIProvider();
  const resAm = await mock.transcribe({ audioBuffer: Buffer.alloc(100), lang: 'am' });
  ok(resAm.text === 'ሳራ በቀለ' && resAm.engine === 'mock', 'Mock transcribes Amharic deterministically');

  const resOm = await mock.transcribe({ audioBuffer: Buffer.alloc(100), lang: 'om' });
  ok(resOm.text === 'Caaltuu Dheeressa', 'Mock transcribes Oromo deterministically');

  const resTi = await mock.transcribe({ audioBuffer: Buffer.alloc(100), lang: 'ti' });
  ok(resTi.text === 'ሳራ ተስፋይ', 'Mock transcribes Tigrinya deterministically');

  const resEn = await mock.transcribe({ audioBuffer: Buffer.alloc(100), lang: 'en' });
  ok(resEn.text === 'Sara Bekele', 'Mock transcribes English deterministically');

  let emptyCaught = false;
  try {
    await mock.transcribe({ audioBuffer: Buffer.alloc(0), lang: 'am' });
  } catch (e) {
    emptyCaught = e.code === 'no-speech';
  }
  ok(emptyCaught, 'Mock throws no-speech on empty buffer');
}

console.log('\n--- 4. Provider Fallback on Upstream Failure ---');
{
  class FailingProvider extends BaseAIProvider {
    constructor() {
      super({ id: 'flaky-primary', name: 'Flaky', supportedLanguages: ['am'] });
    }
    isConfigured() { return true; }
    async transcribe() {
      throw new Error('Connection timeout to upstream service');
    }
  }

  class WorkingFallback extends BaseAIProvider {
    constructor() {
      super({ id: 'stable-fallback', name: 'Stable', supportedLanguages: ['am'] });
    }
    isConfigured() { return true; }
    async transcribe() {
      return { text: 'fallback-success', engine: 'stable-fallback', lang: 'am' };
    }
  }

  const customRegistry = new AIRegistry();
  customRegistry.providers.clear();
  customRegistry.register(new FailingProvider());
  customRegistry.register(new WorkingFallback());

  const result = await customRegistry.transcribe({
    audioBuffer: Buffer.alloc(100),
    mimeType: 'audio/webm',
    lang: 'am',
  });
  ok(result.text === 'fallback-success' && result.engine === 'stable-fallback',
     'transcribe automatically falls back when primary provider fails');
}

if (fail > 0) {
  console.error(`\nFAILED: ${fail} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nPASSED: All AI adapter tests passed successfully.`);
}
