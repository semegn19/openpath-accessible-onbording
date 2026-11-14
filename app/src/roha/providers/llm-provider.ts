/**
 * Roha - Pluggable LLM & External API Provider System
 * Features: V05, L03, F02
 *
 * Core Architectural Rule:
 * 1. Clean Interface Abstraction:
 *    Any AI API (OpenAI, Gemini, Claude, Ollama, Groq, OpenRouter, or Custom REST)
 *    plugs into the `LLMProvider` interface without altering application logic.
 * 2. Deterministic local rules in `router.ts` ALWAYS run first (< 1ms latency, 100% offline).
 * 3. The LLM NEVER directly touches or executes on the DOM.
 *    Any proposed intent MUST pass through `IntentValidator` to verify:
 *    - Schema conformance (schemaVersion 2.0)
 *    - Active mapVersion & target registry resolution
 *    - Explicit rejection of script tags, executable payloads, or forged model approvals.
 */

import { RohaIntent, DiscoveredPageMap, Locale } from '../types';
import { ServerLLMProvider } from './server-provider';

export interface LLMContext {
  activeTargetId?: string;
  activeFormId?: string;
  locale?: Locale;
}

/**
 * Standard Provider Interface
 * Implement this interface to connect any AI backend to Roha.
 */
export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null>;
}

/**
 * Helper to construct the unified Roha Intent System Prompt
 */
export function buildSystemPrompt(currentMap: DiscoveredPageMap, context?: LLMContext): string {
  return `You are the Roha Accessibility Intent Parser.
Your job is to convert user natural language utterances into a valid RohaIntent JSON object.
Allowed intents: "text_scale", "simple_mode", "contrast", "read", "explain", "filter", "pause", "resume", "undo", "propose_answer".
Target IDs available on this page: ${currentMap.resources.map((r) => r.id).join(', ')}.
Map ID: "${currentMap.mapId}", Map Version: ${currentMap.mapVersion}.
You must ONLY output valid JSON matching this exact structure:
{
  "schemaVersion": "2.0",
  "utteranceId": "llm-turn",
  "mapId": "${currentMap.mapId}",
  "mapVersion": ${currentMap.mapVersion},
  "intent": "<intent_name>",
  "targetId": "${context?.activeTargetId || 'page.main'}",
  "payload": {}
}`;
}

/**
 * Helper to sanitize and wrap any parsed JSON object into a strict RohaIntent
 */
export function sanitizeIntent(
  parsed: any,
  currentMap: DiscoveredPageMap,
  context?: LLMContext
): RohaIntent | null {
  if (!parsed || typeof parsed !== 'object' || !parsed.intent) return null;
  return {
    schemaVersion: '2.0',
    utteranceId: `llm-${Date.now()}`,
    mapId: currentMap.mapId,
    mapVersion: currentMap.mapVersion,
    intent: parsed.intent,
    targetId: parsed.targetId || context?.activeTargetId || 'page.main',
    payload: parsed.payload || {},
  };
}

/**
 * 1. Ollama Local LLM Provider Adapter
 * Connects to local Ollama (e.g. llama3.2:1b, qwen2.5:3b).
 */
export class OllamaLLMProvider implements LLMProvider {
  public readonly id = 'ollama-local-llm';
  public readonly name = 'Ollama Local LLM Provider';
  private endpoint: string;
  private model: string;
  private timeoutMs: number;

  constructor(
    endpoint: string = 'http://localhost:11434/api/generate',
    model: string = 'llama3.2:1b',
    timeoutMs: number = 8000
  ) {
    this.endpoint = endpoint;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    const systemPrompt = buildSystemPrompt(currentMap, context);
    const prompt = `${systemPrompt}\n\nUser request: "${utterance}"\nJSON Output:`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!resp.ok) return null;

      const data = await resp.json();
      if (!data.response) return null;

      const parsed = JSON.parse(data.response);
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 2. OpenAI & OpenAI-Compatible LLM Provider Adapter
 * Works with OpenAI (gpt-4o, gpt-4o-mini), Groq, DeepSeek, Together AI, OpenRouter, vLLM, and Mistral!
 */
export interface OpenAIConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class OpenAILLMProvider implements LLMProvider {
  public readonly id = 'openai-llm';
  public readonly name = 'OpenAI Compatible LLM Provider';
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private extraHeaders: Record<string, string>;
  private timeoutMs: number;

  constructor(config: OpenAIConfig = {}) {
    this.endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o-mini';
    this.extraHeaders = config.headers || {};
    this.timeoutMs = config.timeoutMs || 8000;
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    const systemPrompt = buildSystemPrompt(currentMap, context);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.extraHeaders,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: utterance },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!resp.ok) return null;

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 3. Google Gemini LLM Provider Adapter
 * Connects to Google Generative Language API (e.g. gemini-1.5-flash, gemini-1.5-pro).
 */
export interface GeminiConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export class GeminiLLMProvider implements LLMProvider {
  public readonly id = 'gemini-llm';
  public readonly name = 'Google Gemini LLM Provider';
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-1.5-flash';
    this.timeoutMs = config.timeoutMs || 8000;
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    const systemPrompt = buildSystemPrompt(currentMap, context);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\nUser request: "${utterance}"` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!resp.ok) return null;

      const data = await resp.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 4. Anthropic Claude LLM Provider Adapter
 * Connects to Anthropic's Messages API (claude-3-5-sonnet, claude-3-5-haiku).
 */
export interface AnthropicConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
}

export class AnthropicLLMProvider implements LLMProvider {
  public readonly id = 'anthropic-llm';
  public readonly name = 'Anthropic Claude LLM Provider';
  private endpoint: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(config: AnthropicConfig) {
    this.endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-haiku-20241022';
    this.timeoutMs = config.timeoutMs || 8000;
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    const systemPrompt = buildSystemPrompt(currentMap, context);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          system: systemPrompt,
          messages: [{ role: 'user', content: utterance }],
          max_tokens: 300,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!resp.ok) return null;

      const data = await resp.json();
      const text = data.content?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text);
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 5. Generic Custom REST API Provider Adapter
 * Connects to any custom enterprise endpoint or internal microservice.
 */
export interface CustomRESTConfig {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class GenericRESTProvider implements LLMProvider {
  public readonly id = 'custom-rest-provider';
  public readonly name = 'Custom REST API Provider';
  private endpoint: string;
  private headers: Record<string, string>;
  private timeoutMs: number;

  constructor(config: CustomRESTConfig) {
    this.endpoint = config.endpoint;
    this.headers = config.headers || {};
    this.timeoutMs = config.timeoutMs || 8000;
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({
          utterance,
          mapId: currentMap.mapId,
          mapVersion: currentMap.mapVersion,
          resources: currentMap.resources,
          context,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (!resp.ok) return null;

      const parsed = await resp.json();
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 6. Chrome Built-in AI Provider Adapter (Gemini Nano in Chrome)
 * Works directly inside the browser with zero server installation.
 */
export class ChromeBuiltInAIProvider implements LLMProvider {
  public readonly id = 'chrome-builtin-ai';
  public readonly name = 'Chrome Built-in AI (Gemini Nano)';

  public async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const ai = (window as any).ai;
    return !!(ai && ai.languageModel);
  }

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    context?: LLMContext
  ): Promise<RohaIntent | null> {
    if (typeof window === 'undefined') return null;
    const ai = (window as any).ai;
    if (!ai || !ai.languageModel) return null;

    try {
      const session = await ai.languageModel.create({
        systemPrompt: `You are Roha Intent Parser. Map the user request to JSON: {"intent": "text_scale"|"simple_mode"|"contrast"|"read"|"filter", "targetId": "page.main", "payload": {}}`,
      });

      const response = await session.prompt(utterance);
      const parsed = JSON.parse(response);
      return sanitizeIntent(parsed, currentMap, context);
    } catch {
      return null;
    }
  }
}

/**
 * 7. Mock LLM Provider for unit and contract testing
 */
export class MockLLMProvider implements LLMProvider {
  public readonly id = 'mock-llm-provider';
  public readonly name = 'Mock LLM Provider (Testing)';

  public async interpret(
    utterance: string,
    currentMap: DiscoveredPageMap,
    _context?: LLMContext
  ): Promise<RohaIntent | null> {
    const lower = utterance.toLowerCase();

    if (lower.includes('giant') || lower.includes('huge') || lower.includes('massive text')) {
      return {
        schemaVersion: '2.0',
        utteranceId: `mock-llm-${Date.now()}`,
        mapId: currentMap.mapId,
        mapVersion: currentMap.mapVersion,
        intent: 'text_scale',
        targetId: 'page.main',
        payload: { percent: 200 },
      };
    }

    if (lower.includes('tell me what is on this screen') || lower.includes('overview')) {
      return {
        schemaVersion: '2.0',
        utteranceId: `mock-llm-${Date.now()}`,
        mapId: currentMap.mapId,
        mapVersion: currentMap.mapVersion,
        intent: 'explain',
        targetId: 'page.main',
        payload: {},
      };
    }

    return null;
  }
}

/**
 * Universal Configuration Options for Roha.configureAPI(...)
 */
export interface UniversalAPIConfig {
  provider: 'server' | 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'chrome' | 'custom' | 'mock';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Universal Provider Factory Function
 * Allows switching between any AI backend with a simple configuration object.
 */
export function createLLMProvider(config: UniversalAPIConfig): LLMProvider {
  switch (config.provider) {
    case 'server':
      return new ServerLLMProvider(config.endpoint);
    case 'openai':
      return new OpenAILLMProvider({
        apiKey: config.apiKey,
        endpoint: config.endpoint,
        model: config.model,
        headers: config.headers,
        timeoutMs: config.timeoutMs,
      });
    case 'gemini':
      return new GeminiLLMProvider({
        apiKey: config.apiKey || '',
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    case 'anthropic':
      return new AnthropicLLMProvider({
        apiKey: config.apiKey || '',
        endpoint: config.endpoint,
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    case 'ollama':
      return new OllamaLLMProvider(
        config.endpoint || 'http://localhost:11434/api/generate',
        config.model || 'llama3.2:1b',
        config.timeoutMs || 8000
      );
    case 'chrome':
      return new ChromeBuiltInAIProvider();
    case 'custom':
      return new GenericRESTProvider({
        endpoint: config.endpoint || '',
        headers: config.headers,
        timeoutMs: config.timeoutMs,
      });
    case 'mock':
    default:
      return new MockLLMProvider();
  }
}
