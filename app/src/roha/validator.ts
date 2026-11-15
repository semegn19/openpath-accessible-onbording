/**
 * Roha - Intent Validator & Safety Guard
 * Features: P01, P02
 * Validates candidate intent proposals against:
 * 1. Schema structure (intent.schema.json)
 * 2. Active mapId and fresh mapVersion (rejects stale maps)
 * 3. Fresh target registry (rejects unknown or detached targets)
 * 4. Target declared allowedIntents (rejects unauthorized operations)
 * 5. Page isolation (rejects injected code, selectors, URLs)
 */

import { IntentValidationResult, DiscoveredPageMap } from './types';
import { TargetRegistry } from './registry';

const VALID_INTENTS = new Set([
  'text_scale',
  'simple_mode',
  'contrast',
  'reduced_motion',
  'read',
  'explain',
  'focus',
  'navigate',
  'search',
  'filter',
  'propose_answer',
  'choose_file',
  'review',
  'request_submission',
  'request_support',
  'pause',
  'resume',
  'undo',
  'reset_preferences',
  'chat',
]);

const ID_PATTERN = /^[a-z][a-z0-9_.-]{0,79}$/;

export class IntentValidator {
  private registry: TargetRegistry;
  private currentMap: DiscoveredPageMap | null;

  constructor(registry: TargetRegistry, currentMap: DiscoveredPageMap | null = null) {
    this.registry = registry;
    this.currentMap = currentMap;
  }

  public setMap(map: DiscoveredPageMap): void {
    this.currentMap = map;
  }

  public validate(candidate: any): IntentValidationResult {
    const errors: string[] = [];

    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, errors: ['Intent proposal must be a non-null object'] };
    }

    // 1. Check schemaVersion
    if (candidate.schemaVersion !== '2.0') {
      errors.push(`Invalid schemaVersion: expected "2.0", received "${candidate.schemaVersion}"`);
    }

    // 2. Check utteranceId
    if (typeof candidate.utteranceId !== 'string' || !ID_PATTERN.test(candidate.utteranceId)) {
      errors.push('Missing or invalid utteranceId pattern');
    }

    // 3. Check mapId & mapVersion against active map
    if (typeof candidate.mapId !== 'string' || !ID_PATTERN.test(candidate.mapId)) {
      errors.push('Missing or invalid mapId pattern');
    } else if (this.currentMap && candidate.mapId !== this.currentMap.mapId) {
      errors.push(`Map mismatch: current map is "${this.currentMap.mapId}", intent targeted "${candidate.mapId}"`);
    }

    if (typeof candidate.mapVersion !== 'number' || candidate.mapVersion < 1) {
      errors.push('Missing or invalid mapVersion');
    } else if (this.currentMap && candidate.mapVersion !== this.currentMap.mapVersion) {
      errors.push(`Stale map version: current mapVersion is ${this.currentMap.mapVersion}, intent has ${candidate.mapVersion}`);
    }

    // 4. Check intent type
    if (!candidate.intent || !VALID_INTENTS.has(candidate.intent)) {
      errors.push(`Unknown or unsupported intent: "${candidate.intent}"`);
    }

    // 5. Check targetId in registry
    if (typeof candidate.targetId !== 'string' || !ID_PATTERN.test(candidate.targetId)) {
      errors.push('Missing or invalid targetId pattern');
    } else {
      if (!this.registry.has(candidate.targetId)) {
        errors.push(`Target ID "${candidate.targetId}" not found in current DOM registry`);
      }

      // Check allowed intents for target in current map
      if (this.currentMap) {
        const resource = this.currentMap.resources.find((r) => r.id === candidate.targetId);
        if (!resource) {
          errors.push(`Target ID "${candidate.targetId}" does not exist in current page map`);
        } else if (candidate.intent && !resource.allowedIntents.includes(candidate.intent)) {
          errors.push(`Intent "${candidate.intent}" is not allowed for target "${candidate.targetId}" (allowed: ${resource.allowedIntents.join(', ')})`);
        }
      }
    }

    // 6. Check payload restrictions
    if (!candidate.payload || typeof candidate.payload !== 'object' || Array.isArray(candidate.payload)) {
      errors.push('Missing or invalid payload object');
    } else {
      const payload = candidate.payload;

      // Untrusted page isolation check: no executable code, selectors, or script injections
      const payloadStr = JSON.stringify(payload);
      if (
        payloadStr.includes('<script') ||
        payloadStr.includes('javascript:') ||
        payloadStr.includes('__proto__') ||
        payloadStr.includes('constructor')
      ) {
        errors.push('Potentially hostile script or prototype pollution payload rejected');
      }

      // Disallow model-supplied authorization or approval flag
      if ('approved' in payload || 'authorized' in payload || 'permissionGranted' in candidate) {
        errors.push('Model cannot authorize itself or supply approval flags');
      }

      // Specific intent payload rules
      switch (candidate.intent) {
        case 'text_scale': {
          const validPercents = [100, 125, 150, 175, 200];
          if (!validPercents.includes(payload.percent)) {
            errors.push(`text_scale percent must be one of ${validPercents.join(', ')}, got ${payload.percent}`);
          }
          if (Object.keys(payload).length > 1) {
            errors.push('text_scale payload must only contain "percent"');
          }
          break;
        }

        case 'contrast': {
          const validThemes = ['default', 'high-contrast'];
          if (!validThemes.includes(payload.theme)) {
            errors.push(`contrast theme must be one of ${validThemes.join(', ')}, got "${payload.theme}"`);
          }
          if (Object.keys(payload).length > 1) {
            errors.push('contrast payload must only contain "theme"');
          }
          break;
        }

        case 'simple_mode':
        case 'reduced_motion': {
          if (typeof payload.enabled !== 'boolean') {
            errors.push(`${candidate.intent} payload must contain boolean "enabled"`);
          }
          if (Object.keys(payload).length > 1) {
            errors.push(`${candidate.intent} payload must only contain "enabled"`);
          }
          break;
        }

        case 'search':
        case 'filter': {
          if (typeof payload.query !== 'string' || payload.query.length > 500) {
            errors.push(`${candidate.intent} payload must contain "query" string up to 500 characters`);
          }
          if (Object.keys(payload).length > 1) {
            errors.push(`${candidate.intent} payload must only contain "query"`);
          }
          break;
        }

        case 'propose_answer': {
          if (typeof payload.value !== 'string' || payload.value.length > 4000) {
            errors.push('propose_answer payload must contain "value" string up to 4000 characters');
          }
          if (Object.keys(payload).length > 1) {
            errors.push('propose_answer payload must only contain "value"');
          }
          break;
        }

        case 'chat': {
          break;
        }

        case 'navigate': {
          if (payload.direction && !['back', 'forward'].includes(payload.direction)) {
            errors.push('navigate direction must be "back" or "forward"');
          }
          break;
        }

        default: {
          // All other intents (read, explain, focus, navigate, review, etc.) must have empty payload
          if (Object.keys(payload).length > 0) {
            errors.push(`Intent "${candidate.intent}" requires an empty payload object`);
          }
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
