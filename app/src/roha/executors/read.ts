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
  private currentPlayId: number = 0;
  private currentAbortController: AbortController | null = null;

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
    const playId = ++this.currentPlayId;

    if (!text || !text.trim()) return false;

    // Use /api/tts for Ethiopian languages: Amharic, Tigrinya, and Afaan Oromoo
    const langCode = locale.toLowerCase().slice(0, 2);
    const isEthiopicScript = /[\u1200-\u137F]/u.test(text);
    const effectiveLang = (langCode === 'ti' || (isEthiopicScript && langCode !== 'am')) ? 'ti'
      : (langCode === 'om' ? 'om' : langCode === 'so' ? 'so' : (langCode === 'am' || isEthiopicScript) ? 'am' : langCode);
    const useApiTts = isEthiopicScript || langCode === 'am' || langCode === 'ti' || langCode === 'om' || langCode === 'so';

    if (useApiTts && typeof window !== 'undefined') {
      try {
        const ttsUrl = `/api/tts?lang=${encodeURIComponent(effectiveLang)}&text=${encodeURIComponent(text.trim())}`;
        this.unlock();
        this.isSpeaking = true;
        this.statusCallback?.({ speaking: true, text });

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.audioCtx) this.audioCtx = new AudioCtx();
          if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();

          const controller = new AbortController();
          this.currentAbortController = controller;

          fetch(ttsUrl, { signal: controller.signal })
            .then(res => {
              if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
              return res.arrayBuffer();
            })
            .then(buf => {
              if (this.currentPlayId !== playId) return null;
              return this.audioCtx!.decodeAudioData(buf);
            })
            .then(decoded => {
              if (!decoded || this.currentPlayId !== playId) return;
              this.stopAudio();
              const source = this.audioCtx!.createBufferSource();
              source.buffer = decoded;
              source.connect(this.audioCtx!.destination);
              source.onended = () => {
                if (this.currentPlayId === playId) {
                  this.isSpeaking = false;
                  this.currentSource = null;
                  this.statusCallback?.({ speaking: false });
                }
              };
              this.currentSource = source;
              if (this.audioCtx!.state === 'suspended') {
                void this.audioCtx!.resume();
              }
              source.start(0);
            })
            .catch(err => {
              if (err.name === 'AbortError' || this.currentPlayId !== playId) return;
              const audio = new Audio(ttsUrl);
              this.currentAudio = audio;
              audio.onended = () => {
                if (this.currentPlayId === playId) {
                  this.isSpeaking = false;
                  this.currentAudio = null;
                  this.statusCallback?.({ speaking: false });
                }
              };
              audio.play().catch(() => {
                if (this.currentPlayId === playId) {
                  this.isSpeaking = false;
                  this.statusCallback?.({ speaking: false, text });
                }
              });
            });
          return true;
        }
      } catch (e) {
        console.error('[Roha TTS Exception]', e);
      }
      return true;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.statusCallback?.({ speaking: false, text });
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        if (this.currentPlayId === playId) {
          this.isSpeaking = true;
          this.statusCallback?.({ speaking: true, text });
        }
      };

      utterance.onend = () => {
        if (this.currentPlayId === playId) {
          this.isSpeaking = false;
          this.statusCallback?.({ speaking: false });
        }
      };

      utterance.onerror = () => {
        if (this.currentPlayId === playId) {
          this.isSpeaking = false;
          this.statusCallback?.({ speaking: false });
        }
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
    this.currentPlayId++;
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {}
      this.currentAbortController = null;
    }
    this.stopAudio();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.statusCallback?.({ speaking: false });
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking;
  }
}
