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
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor(registry: TargetRegistry) {
    this.registry = registry;
  }

  public setStatusCallback(cb: (status: { speaking: boolean; text?: string }) => void): void {
    this.statusCallback = cb;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === 'suspended') {
          void this.audioCtx.resume();
        }
      }
    } catch {}
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
    } else if (targetId === 'page.main') {
      const h1 = el.querySelector('h1')?.textContent?.trim() || '';
      const desc = el.querySelector('.op-step-desc, .op-desc, p:not([hidden]):not([aria-hidden="true"])')?.textContent?.trim() || '';
      const choices = Array.from(el.querySelectorAll<HTMLElement>('.op-choice, label, input[type="radio"], input[type="checkbox"]'))
        .filter(c => c.offsetParent !== null && !c.closest('[hidden], [data-roha-ignore], [data-roha-assistant]'))
        .map(c => c.textContent?.trim() || '')
        .filter(c => c.length > 0 && !c.includes('🔊') && c !== h1 && c !== desc);

      const parts: string[] = [];
      if (h1) parts.push(h1);
      if (desc && desc !== h1) parts.push(desc);
      if (choices.length > 0) {
        const unique = Array.from(new Set(choices));
        parts.push(unique.join('። '));
      }
      textToRead = parts.join('። ') || el.textContent?.trim() || '';
    } else {
      textToRead = el.textContent?.trim() || '';
    }

    if (!textToRead) return false;
    return this.speak(textToRead, locale);
  }

  public speak(text: string, locale: string = 'en'): boolean {
    this.stop();
    this.statusCallback?.({ speaking: false, text });

    if (!text || !text.trim()) return false;

    // Detect if text contains Amharic/Ethiopic script ([\u1200-\u137F]) or locale is Amharic
    const hasAmharic = /[\u1200-\u137F]/u.test(text) || locale.startsWith('am');

    if (hasAmharic && typeof window !== 'undefined') {
      try {
        const ttsUrl = `/api/tts?lang=am&text=${encodeURIComponent(text.trim())}`;
        this.unlock();
        this.isSpeaking = true;
        this.statusCallback?.({ speaking: true, text });

        // Web Audio API decodes and plays without transient activation expiry
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.audioCtx) this.audioCtx = new AudioCtx();
          if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();

          fetch(ttsUrl)
            .then(res => {
              if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
              return res.arrayBuffer();
            })
            .then(buf => this.audioCtx!.decodeAudioData(buf))
            .then(decoded => {
              this.stopAudio();
              const source = this.audioCtx!.createBufferSource();
              source.buffer = decoded;
              source.connect(this.audioCtx!.destination);
              source.onended = () => {
                this.isSpeaking = false;
                this.currentSource = null;
                this.statusCallback?.({ speaking: false });
              };
              this.currentSource = source;
              if (this.audioCtx!.state === 'suspended') {
                void this.audioCtx!.resume();
              }
              source.start(0);
            })
            .catch(() => {
              // Fallback to HTML5 Audio element
              const audio = new Audio(ttsUrl);
              this.currentAudio = audio;
              audio.onended = () => {
                this.isSpeaking = false;
                this.currentAudio = null;
                this.statusCallback?.({ speaking: false });
              };
              audio.play().catch(() => {
                this.isSpeaking = false;
                this.statusCallback?.({ speaking: false, text });
              });
            });
          return true;
        }
      } catch (e) {
        console.error('[Roha TTS Exception]', e);
      }
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.statusCallback?.({ speaking: false, text });
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale.startsWith('am') ? 'am-ET' : 'en-US';
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = locale.startsWith('am')
        ? voices.find(v => v.lang.toLowerCase().startsWith('am'))
        : voices.find(v => v.lang.toLowerCase().startsWith('en'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

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

  private stopAudio(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
  }

  public stop(): void {
    this.stopAudio();
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
