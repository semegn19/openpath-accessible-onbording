import { rc } from './copy';
/**
 * Roha - Voice Provider & Turn-Taking Manager
 * Features: V01, V02, V03
 * Handles microphone permissions, visible listening/speaking states,
 * natural turn-taking without a click per question, and echo prevention.
 */

export type VoiceState =
  | 'unpermitted'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'error';

export interface VoiceManagerCallbacks {
  onStateChange: (state: VoiceState, message?: string) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
}

export class VoiceManager {
  private state: VoiceState = 'unpermitted';
  private recognition: any = null;
  private callbacks: VoiceManagerCallbacks;
  private locale: string = 'en-US';
  private isEchoMuted: boolean = false;
  private permissionGranted: boolean = false;
  private autoRestart: boolean = false;

  constructor(callbacks: VoiceManagerCallbacks, locale: string = 'en') {
    this.callbacks = callbacks;
    this.setLocale(locale);
  }

  public setLocale(locale: string): void {
    this.locale = locale.startsWith('am') ? 'am-ET' : 'en-US';
    if (this.recognition) {
      this.recognition.lang = this.locale;
    }
  }

  public getState(): VoiceState {
    return this.state;
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Check Web Speech API availability
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.state = 'error';
      this.callbacks.onStateChange('error', rc('roha.voiceUnsupported', this.locale));
      return false;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close test stream
        stream.getTracks().forEach((track) => track.stop());
      }

      this.permissionGranted = true;
      this.state = 'ready';
      this.callbacks.onStateChange('ready', rc('roha.microphoneEnabled', this.locale));
      this.initRecognition(SpeechRecognition);
      return true;
    } catch (err: any) {
      this.permissionGranted = false;
      this.state = 'unpermitted';
      const msg = err.name === 'NotAllowedError'
        ? rc('roha.microphoneDenied', this.locale)
        : rc('roha.microphoneUnavailable', this.locale);
      this.callbacks.onStateChange('unpermitted', msg);
      return false;
    }
  }

  public startListening(continuous: boolean = true): void {
    if (!this.permissionGranted) {
      this.callbacks.onError(rc('roha.microphonePermission', this.locale));
      return;
    }

    if (this.isEchoMuted) return;

    this.autoRestart = continuous;

    if (!this.recognition) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.initRecognition(SpeechRecognition);
      }
    }

    if (this.recognition) {
      try {
        this.recognition.start();
        this.state = 'listening';
        this.callbacks.onStateChange('listening', rc('roha.listening', this.locale));
      } catch {
        // Already started
      }
    }
  }

  public stopListening(): void {
    this.autoRestart = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.state = 'ready';
    this.callbacks.onStateChange('ready', rc('roha.microphoneReady', this.locale));
  }

  /**
   * Echo prevention: mutes recognition during speech playback to avoid self-transcription (V02)
   */
  public setEchoMute(muted: boolean): void {
    this.isEchoMuted = muted;
    if (muted) {
      if (this.recognition && this.state === 'listening') {
        try {
          this.recognition.abort();
        } catch {}
      }
      this.state = 'speaking';
      this.callbacks.onStateChange('speaking');
    } else {
      if (this.permissionGranted && this.autoRestart) {
        // Resume listening automatically for natural turn-taking (V02)
        setTimeout(() => {
          if (!this.isEchoMuted && this.autoRestart) {
            this.startListening(true);
          }
        }, 150);
      } else {
        this.state = 'ready';
        this.callbacks.onStateChange('ready');
      }
    }
  }

  public destroy(): void {
    this.autoRestart = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.state = 'unpermitted';
  }

  private initRecognition(SpeechRecognitionClass: any): void {
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = this.locale;

    this.recognition.onresult = (event: any) => {
      if (this.isEchoMuted) return;

      let transcript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }

      this.callbacks.onTranscript(transcript, isFinal);

      if (isFinal) {
        this.state = 'processing';
        this.callbacks.onStateChange('processing', rc('roha.processing', this.locale));
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Recoverable silence (V04, V05)
        if (this.autoRestart && !this.isEchoMuted) {
          try {
            this.recognition.start();
          } catch {}
        }
        return;
      }

      if (event.error === 'not-allowed') {
        this.permissionGranted = false;
        this.state = 'unpermitted';
        this.callbacks.onStateChange('unpermitted', rc('roha.microphoneDenied', this.locale));
        return;
      }

      this.state = 'ready';
      this.callbacks.onError(rc('roha.voiceInputError', this.locale));
    };

    this.recognition.onend = () => {
      if (this.autoRestart && !this.isEchoMuted && this.permissionGranted) {
        try {
          this.recognition.start();
        } catch {}
      } else if (this.state === 'listening') {
        this.state = 'ready';
        this.callbacks.onStateChange('ready', rc('roha.microphoneReady', this.locale));
      }
    };
  }
}

