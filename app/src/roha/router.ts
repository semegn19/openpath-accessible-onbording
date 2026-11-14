/**
 * Roha - Local Deterministic Intent Router
 * Features: V05, P01
 * Translates user phrases into schema-valid RohaIntent objects
 * strictly locally without requiring an LLM.
 */

import { RohaIntent, DiscoveredPageMap, Locale } from './types';
import { TargetRegistry } from './registry';
import { LLMProvider } from './providers/llm-provider';

export interface RouteContext {
  activeTargetId?: string;
  activeFormId?: string;
  currentTextScalePercent?: number;
  locale?: Locale;
}

export class IntentRouter {
  private registry: TargetRegistry;
  private currentMap: DiscoveredPageMap;
  private llmProvider?: LLMProvider;
  private utteranceCounter = 0;

  constructor(registry: TargetRegistry, currentMap: DiscoveredPageMap, llmProvider?: LLMProvider) {
    this.registry = registry;
    this.currentMap = currentMap;
    this.llmProvider = llmProvider;
  }

  public setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  public getLLMProvider(): LLMProvider | undefined {
    return this.llmProvider;
  }

  public getRegistry(): TargetRegistry {
    return this.registry;
  }

  public updateMap(map: DiscoveredPageMap): void {
    this.currentMap = map;
  }

  /**
   * Evaluates natural utterance asynchronously:
   * 1. Runs deterministic local rules first (0ms latency, 100% offline).
   * 2. If no local rule matches and an LLMProvider is attached, delegates
   *    to the LLM to propose a RohaIntent JSON.
   */
  public async routeWithFallback(utterance: string, context: RouteContext = {}): Promise<RohaIntent | null> {
    const localIntent = this.route(utterance, context);
    if (localIntent) return localIntent;

    if (this.llmProvider) {
      try {
        const proposal = await this.llmProvider.interpret(utterance, this.currentMap, context);
        return proposal;
      } catch {
        return null;
      }
    }

    return null;
  }

  public route(utterance: string, context: RouteContext = {}): RohaIntent | null {
    const raw = utterance.trim().toLowerCase();
    if (!raw) return null;

    const nextUtteranceId = `turn-${String(++this.utteranceCounter).padStart(3, '0')}`;
    const mapId = this.currentMap.mapId;
    const mapVersion = this.currentMap.mapVersion;
    const pageMainId = 'page.main';
    const activeTarget = context.activeTargetId || pageMainId;
    const activeForm = context.activeFormId || this.findFirstFormId() || pageMainId;
    const currentScale = context.currentTextScalePercent || 100;

    // 1. Text scale (A01)
    if (
      raw.includes('bigger') ||
      raw.includes('enlarge') ||
      raw.includes('larger') ||
      raw.includes('አግዝፍ') ||
      raw.includes('አሳድግ') ||
      raw.includes('ትልቅ')
    ) {
      const nextScale = currentScale >= 200 ? 200 : currentScale === 100 ? 150 : 200;
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'text_scale',
        targetId: pageMainId,
        payload: { percent: nextScale as 150 | 200 },
      };
    }

    if (
      raw.includes('smaller') ||
      raw.includes('reduce text') ||
      raw.includes('አሳንስ')
    ) {
      const nextScale = currentScale <= 100 ? 100 : currentScale === 200 ? 150 : 100;
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'text_scale',
        targetId: pageMainId,
        payload: { percent: nextScale as 100 | 150 },
      };
    }

    if (
      raw === 'reset' ||
      raw.includes('reset size') ||
      raw.includes('normal size') ||
      raw.includes('ወደ ነበረበት መልስ')
    ) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'text_scale',
        targetId: pageMainId,
        payload: { percent: 100 },
      };
    }

    // 2. Simple mode / explain (A02)
    if (
      raw.includes('simple words') ||
      raw.includes('simple mode') ||
      raw.includes('explain simply') ||
      raw.includes('ቀላል ቃላት')
    ) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'simple_mode',
        targetId: pageMainId,
        payload: { enabled: true },
      };
    }

    if (raw.includes('original words') || raw.includes('normal mode') || raw.includes('ቀላል አቁም')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'simple_mode',
        targetId: pageMainId,
        payload: { enabled: false },
      };
    }

    // Signature Experience 1: "I'm Stuck" & Recovery (Situation mapping)
    if (
      raw.includes('stuck') ||
      raw.includes('help') ||
      raw.includes('እርዳኝ') ||
      raw.includes('አልገባኝም') ||
      raw.includes("can't read") ||
      raw.includes('cant read') ||
      raw.includes("can't type") ||
      raw.includes('cant type') ||
      raw.includes('no document') ||
      raw.includes('መታወቂያ የለኝም') ||
      raw.includes('someone is helping') ||
      raw.includes('connection stopped') ||
      raw.includes("don't want to answer")
    ) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'explain',
        targetId: activeTarget,
        payload: { stuckReason: utterance },
      };
    }

    // Repeat question
    if (raw === 'repeat' || raw.includes('repeat the question') || raw.includes('ድገም') || raw.includes('ድገመው')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'read',
        targetId: activeTarget,
        payload: { repeat: true },
      };
    }

    // Go back
    if (raw.includes('go back') || raw.includes('ወደ ኋላ') || raw.includes('ተመለስ') || raw === 'back') {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'navigate',
        targetId: pageMainId,
        payload: { direction: 'back' },
      };
    }

    // Name splitting: "Keep my first name; change my last name"
    if ((raw.includes('keep my first name') || raw.includes('change my last name')) && context.activeTargetId) {
      const match = raw.match(/change my last name (?:to )?([a-zA-Z\u1200-\u137F]+)/i);
      const newPart = match ? match[1] : '';
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'propose_answer',
        targetId: context.activeTargetId,
        payload: { partial: 'last', partToKeep: 'first', value: newPart },
      };
    }

    if (raw.includes('explain') || raw.includes('አብራራ') || raw.includes('ምን ማለት ነው')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'explain',
        targetId: activeTarget,
        payload: {},
      };
    }

    // 3. Contrast (A04)
    if (raw.includes('high contrast') || raw.includes('ጎላ ያለ') || raw.includes('ኮንትራስት')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'contrast',
        targetId: pageMainId,
        payload: { theme: 'high-contrast' },
      };
    }

    if (raw.includes('normal contrast') || raw.includes('default contrast')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'contrast',
        targetId: pageMainId,
        payload: { theme: 'default' },
      };
    }

    // 4. Reduced motion
    if (raw.includes('reduce motion') || raw.includes('stop motion')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'reduced_motion',
        targetId: pageMainId,
        payload: { enabled: true },
      };
    }

    // 5. Read / Speak (A03)
    if (raw.includes('read') || raw.includes('አንብብ') || raw.includes('ስማኝ')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'read',
        targetId: activeTarget,
        payload: {},
      };
    }

    // 6. Stop / Pause (V01, V05)
    if (raw === 'stop' || raw.includes('stop speaking') || raw.includes('pause') || raw.includes('አቁም')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'pause',
        targetId: pageMainId,
        payload: {},
      };
    }

    // 7. Resume / Continue
    if (raw === 'continue' || raw.includes('resume') || raw.includes('ቀጥል')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'resume',
        targetId: pageMainId,
        payload: {},
      };
    }

    // 8. Undo
    if (raw === 'undo' || raw.includes('revert') || raw.includes('መልስ')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'undo',
        targetId: pageMainId,
        payload: {},
      };
    }

    // 9. Reset preferences
    if (raw.includes('reset preferences') || raw.includes('clear settings')) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'reset_preferences',
        targetId: pageMainId,
        payload: {},
      };
    }

    // 10. Review before submit (O08)
    if (
      raw.includes('review') ||
      raw.includes('read my answers') ||
      raw.includes('check answers') ||
      raw.includes('ገምግም') ||
      raw.includes('መልሶቼን አንብብ')
    ) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'review',
        targetId: activeForm,
        payload: {},
      };
    }

    // 11. Request submission (O08)
    if (
      raw.includes('submit') ||
      raw.includes('finish') ||
      raw.includes('send') ||
      raw.includes('ጨርስ') ||
      raw.includes('ላክ')
    ) {
      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'request_submission',
        targetId: activeForm,
        payload: {},
      };
    }

    // 12. Support needs filter (C02)
    if (raw.includes('flexible hours') || raw.includes('written instructions') || raw.includes('filter')) {
      const filterTarget = this.findFilterTargetId() || pageMainId;
      let query = raw;
      if (raw.includes('flexible')) query = 'flexible';
      if (raw.includes('written')) query = 'written';

      return {
        schemaVersion: '2.0',
        utteranceId: nextUtteranceId,
        mapId,
        mapVersion,
        intent: 'filter',
        targetId: filterTarget,
        payload: { query },
      };
    }

    // 13. Specific Field targeting or Answering
    if (context.activeTargetId && context.activeTargetId.startsWith('field.')) {
      // If an LLM provider is attached, let LLM interpret first so conversational commands
      // (e.g. "make letters gigantic") are not blindly treated as form field values.
      if (!this.llmProvider) {
        return {
          schemaVersion: '2.0',
          utteranceId: nextUtteranceId,
          mapId,
          mapVersion,
          intent: 'propose_answer',
          targetId: context.activeTargetId,
          payload: { value: utterance },
        };
      }
    }

    return null;
  }

  private findFirstFormId(): string | undefined {
    const formRes = this.currentMap.resources.find((r) => r.kind === 'form');
    return formRes?.id;
  }

  private findFilterTargetId(): string | undefined {
    const filterRes = this.currentMap.resources.find(
      (r) => r.kind === 'search' || r.allowedIntents.includes('filter')
    );
    return filterRes?.id;
  }
}
