import type { LLMProvider } from './llm-provider';
import type { DiscoveredPageMap, RohaIntent } from '../types';

export class ServerLLMProvider implements LLMProvider {
  readonly id = 'server';
  readonly name = 'Configured server provider';
  private revision: number | null = null;
  private approved = false;
  constructor(private endpoint = '/api/assistant') {}
  async describe(): Promise<{ provider: string; model: string; revision: number }> {
    const response = await fetch(`${this.endpoint}/config`, { credentials: 'omit', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('AI settings are unavailable');
    const config = await response.json();
    if (!Number.isSafeInteger(config.revision) || typeof config.provider !== 'string' || typeof config.model !== 'string') throw new Error('Invalid AI configuration');
    this.revision = config.revision; this.approved = false; return config;
  }
  consent(value: boolean): void { this.approved = value; }
  hasConsent(): boolean { return this.approved; }
  async interpret(utterance: string, map: DiscoveredPageMap, context?: any): Promise<RohaIntent | null> {
    if (!this.approved || this.revision === null) return null;
    const resources = map.resources.filter(r => r.privacy === 'page-metadata').slice(0, 100)
      .map(r => ({ id: r.id, privacy: r.privacy, allowedIntents: r.allowedIntents }));
    const response = await fetch(`${this.endpoint}/interpret`, {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(14000),
      body: JSON.stringify({ consent: true, configRevision: this.revision, utterance, locale: context?.locale || map.locale,
        screenContext: context?.screenContext,
        map: { mapId: map.mapId, mapVersion: map.mapVersion, resources } }),
    });
    if (response.status === 409) { this.approved = false; throw new Error('Provider changed. Review AI options again.'); }
    if (!response.ok) return null;
    const data = await response.json();
    return data.intent || null;
  }
}
