/**
 * Roha - Privacy & Data Separation Service
 * Features: P03, O06
 * Strictly separates public application responses, identity documents,
 * and private accommodation requests. Prevents disclosure to employers or generic logs.
 */

import { PrivacyClass } from './types';

export interface FormSubmissionPayloads {
  publicApplication: Record<string, any>;
  privateSupport: Record<string, any>;
  identityDocuments: Record<string, any>;
}

export class PrivacyManager {
  /**
   * Separates form values according to declared privacy classifications
   */
  public static separatePayloads(
    formData: Record<string, any>,
    fieldClassifications: Record<string, PrivacyClass>
  ): FormSubmissionPayloads {
    const publicApplication: Record<string, any> = {};
    const privateSupport: Record<string, any> = {};
    const identityDocuments: Record<string, any> = {};

    for (const [key, value] of Object.entries(formData)) {
      if (value === undefined || value === null || value === '') continue;

      const classification = fieldClassifications[key] || this.inferPrivacyClass(key);

      switch (classification) {
        case 'private-support':
          privateSupport[key] = value;
          break;
        case 'identity':
          identityDocuments[key] = value;
          break;
        case 'application':
        case 'page-metadata':
        default:
          publicApplication[key] = value;
          break;
      }
    }

    return {
      publicApplication,
      privateSupport,
      identityDocuments,
    };
  }

  /**
   * Sanitizes objects before writing to logs, telemetry, or public exports
   */
  public static sanitizeForTelemetry(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['support', 'accommodation', 'disability', 'medical', 'id', 'phone', 'name', 'file'];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeForTelemetry(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private static inferPrivacyClass(fieldName: string): PrivacyClass {
    const lower = fieldName.toLowerCase();
    if (lower.includes('support') || lower.includes('accommodation') || lower.includes('need')) {
      return 'private-support';
    }
    if (lower.includes('kebele') || lower.includes('fayda') || lower.includes('refugee') || lower.includes('passport') || lower.includes('id_number')) {
      return 'identity';
    }
    return 'application';
  }
}

