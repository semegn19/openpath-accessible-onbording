/**
 * Roha - Minimal Opt-in Draft Service
 * Features: O09, F04
 * Persists learner progress with explicit opt-in.
 * Excludes sensitive fields (private support, passwords, identity bytes) by default.
 * Provides resume recap, portable export, and one-click deletion.
 */

export interface SavedDraft {
  formId: string;
  timestamp: number;
  idempotencyKey: string;
  permittedData: Record<string, any>;
  omittedFields: string[];
}

export class DraftService {
  private storageKeyPrefix = 'roha_draft_';

  public saveDraft(
    formId: string,
    data: Record<string, any>,
    sensitiveFields: string[] = ['support', 'accommodation', 'id_number', 'file', 'password']
  ): SavedDraft | null {
    if (typeof window === 'undefined') return null;

    const permittedData: Record<string, any> = {};
    const omittedFields: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      const isSensitive = sensitiveFields.some((s) => key.toLowerCase().includes(s));
      if (isSensitive) {
        omittedFields.push(key);
      } else {
        permittedData[key] = value;
      }
    }

    const draft: SavedDraft = {
      formId,
      timestamp: Date.now(),
      idempotencyKey: this.generateIdempotencyKey(formId),
      permittedData,
      omittedFields,
    };

    try {
      localStorage.setItem(`${this.storageKeyPrefix}${formId}`, JSON.stringify(draft));
      return draft;
    } catch {
      return null;
    }
  }

  public getDraft(formId: string): SavedDraft | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${this.storageKeyPrefix}${formId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public deleteDraft(formId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${this.storageKeyPrefix}${formId}`);
  }

  public exportDraftJson(formId: string): string | null {
    const draft = this.getDraft(formId);
    if (!draft) return null;
    return JSON.stringify(draft, null, 2);
  }

  private generateIdempotencyKey(formId: string): string {
    return `${formId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

