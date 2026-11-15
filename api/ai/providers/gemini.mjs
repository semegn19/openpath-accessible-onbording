/**
 * Google Gemini Multimodal Audio Adapter
 * High-accuracy multilingual speech-to-text (Amharic, Afaan Oromo, Tigrinya, English, etc.)
 * using Gemini Flash multimodal capabilities via standard REST API.
 */
import { BaseAIProvider, getLanguageName, normalizeMimeType } from '../types.mjs';

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

export class GeminiAIProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'gemini',
      name: 'Google Gemini (Multilingual Audio)',
      supportedLanguages: ['am', 'om', 'ti', 'en', '*'],
    });
  }

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  }

  /**
   * @param {Object} params
   * @param {Buffer|Uint8Array} params.audioBuffer
   * @param {string} params.mimeType
   * @param {string} params.lang
   */
  async transcribe({ audioBuffer, mimeType, lang }) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment.');
    }

    const normLang = String(lang || 'am').toLowerCase().trim();
    const langName = getLanguageName(normLang);
    const type = normalizeMimeType(mimeType);
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    const promptText = `Transcribe this audio verbatim in its original language (${langName}). Output only the exact transcribed words without any quotes, notes, formatting, or commentary.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: type,
                data: base64Audio,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 1000,
      },
    };

    const modelsToTry = process.env.GEMINI_MODEL
      ? [process.env.GEMINI_MODEL, ...CANDIDATE_MODELS.filter((m) => m !== process.env.GEMINI_MODEL)]
      : CANDIDATE_MODELS;

    let lastError = null;
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(25000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${res.status}`;
          lastError = new Error(`Gemini model ${model} failed (${res.status}): ${errMsg}`);
          // If model not found or temporarily unavailable, try next model in candidate list
          if (res.status === 404 || res.status === 503 || res.status === 429) {
            continue;
          }
          throw lastError;
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        let rawText = candidate?.content?.parts?.[0]?.text ?? '';

        // Strip surrounding markdown code blocks, quotes, or trailing whitespace
        let cleaned = String(rawText).trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        }
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1).trim();
        }

        if (!cleaned) {
          const emptyErr = new Error('No speech was recognised in that recording.');
          emptyErr.code = 'no-speech';
          emptyErr.status = 422;
          throw emptyErr;
        }

        return {
          text: cleaned,
          engine: 'gemini',
          model,
          lang: normLang,
        };
      } catch (err) {
        if (err.code === 'no-speech') throw err;
        lastError = err;
      }
    }

    throw lastError || new Error('All candidate Gemini models failed to transcribe audio.');
  }
}
