import { rc } from '../copy';
/**
 * Roha - Read Aloud & TTS Executor
 * Feature: A03
 * Reads selected content, questions, choices, and headings aloud.
 * Always maintains sound-off parity with visual text announcements.
 */

import { TargetRegistry } from '../registry';

export class ReadExecutor {
  private registry: TargetRegistry;
  private isSpeaking: boolean = false;
  private statusCallback?: (status: { speaking: boolean; text?: string }) => void;

  constructor(registry: TargetRegistry) {
    this.registry = registry;
  }

  public setStatusCallback(cb: (status: { speaking: boolean; text?: string }) => void): void {
    this.statusCallback = cb;
  }

  public readTarget(targetId: string, locale: string = 'en'): boolean {
    const el = this.registry.getElement(targetId);
    if (!el) return false;

    let textToRead = '';

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      // Find associated label
      const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
      const labelText = label?.textContent?.trim() || el.getAttribute('aria-label') || el.name;
      textToRead = labelText || rc('roha.inputField', locale);

      if (el instanceof HTMLSelectElement) {
        const selected = el.selectedOptions[0]?.text;
        if (selected) {
          textToRead += '. ' + rc('roha.currentSelection', locale, { value: selected });
        }
      }
    } else {
      textToRead = el.textContent?.trim() || '';
    }

    if (!textToRead) return false;
    return this.speak(textToRead, locale);
  }

  public speak(text: string, locale: string = 'en'): boolean {
    this.stop();
    this.statusCallback?.({ speaking: false, text });

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.statusCallback?.({ speaking: false, text });
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale.startsWith('am') ? 'am-ET' : 'en-US';
      utterance.rate = 0.95;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.statusCallback?.({ speaking: true, text });
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.statusCallback?.({ speaking: false });
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.statusCallback?.({ speaking: false });
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      this.isSpeaking = false;
      this.statusCallback?.({ speaking: false, text });
      return false;
    }
  }

  public stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.statusCallback?.({ speaking: false });
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking;
  }
}
