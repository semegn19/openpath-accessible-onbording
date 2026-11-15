import { rc } from './copy';

export type VoiceState = 'unpermitted' | 'ready' | 'listening' | 'processing' | 'speaking' | 'paused' | 'error';
export interface VoiceManagerCallbacks {
  onStateChange: (state: VoiceState, message?: string) => void;
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onInterrupted?: () => void;
}

/** User-initiated microphone access, command recognition and speech echo prevention. */
export class VoiceManager {
  private state: VoiceState = 'unpermitted';
  private recognition: any = null;
  private locale = 'en-US';
  private isEchoMuted = false;
  private permissionGranted = false;
  private autoRestart = false;
  private running = false;
  private generation = 0;
  private permissionRequest: Promise<boolean> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private callbacks: VoiceManagerCallbacks, locale = 'en') { this.setLocale(locale); }

  public setLocale(locale: string): void {
    const l = locale.toLowerCase().slice(0, 2);
    const next = l === 'am' ? 'am-ET'
      : l === 'ti' ? 'ti-ET'
      : l === 'om' ? 'om-ET'
      : 'en-US';
    if (next === this.locale) return;
    this.locale = next;
    const resume = this.autoRestart && !this.isEchoMuted;
    this.releaseRecognition();
    if (resume) this.startListening(true, false);
  }

  public getState(): VoiceState { return this.state; }
  public getEchoMuted(): boolean { return this.isEchoMuted; }

  public requestPermission(): Promise<boolean> {
    if (this.permissionRequest) return this.permissionRequest;
    if (this.permissionGranted) return Promise.resolve(true);
    const generation = this.generation;
    const pending = this.obtainPermission(generation);
    this.permissionRequest = pending;
    void pending.finally(() => { if (this.permissionRequest === pending) this.permissionRequest = null; });
    return pending;
  }

  private async obtainPermission(generation: number): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      this.state = 'error';
      this.callbacks.onStateChange('error', rc('roha.voiceUnsupported', this.locale));
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state = 'error';
      this.callbacks.onStateChange('error', rc(window.isSecureContext === false ? 'roha.microphoneSecure' : 'roha.microphoneUnavailable', this.locale));
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      // Stop/close/unmount while the browser prompt was open must cancel activation.
      if (generation !== this.generation) return false;
      this.permissionGranted = true;
      this.state = 'ready';
      this.callbacks.onStateChange('ready', rc('roha.microphoneEnabled', this.locale));
      return true;
    } catch (error: any) {
      if (generation !== this.generation) return false;
      this.permissionGranted = false;
      this.state = 'unpermitted';
      this.callbacks.onStateChange('unpermitted', rc(error.name === 'NotAllowedError' ? 'roha.microphoneDenied' : 'roha.microphoneUnavailable', this.locale));
      return false;
    }
  }

  public startListening(continuous = true, announce = true): void {
    if (!this.permissionGranted) { this.callbacks.onError(rc('roha.microphonePermission', this.locale)); return; }
    this.autoRestart = continuous;
    if (this.isEchoMuted || this.running) return;
    try {
      if (!this.recognition) {
        const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.initRecognition(Recognition);
      }
      this.recognition.start();
      this.running = true;
      this.state = 'listening';
      // Background restarts update the badge without erasing the last answer.
      this.callbacks.onStateChange('listening', announce ? rc('roha.listening', this.locale) : undefined);
    } catch {
      this.autoRestart = false;
      this.state = 'error';
      this.callbacks.onStateChange('error', rc('roha.voiceInputError', this.locale));
    }
  }

  public stopListening(): void {
    this.generation++;
    this.permissionRequest = null;
    this.autoRestart = false;
    this.releaseRecognition();
    this.state = this.permissionGranted ? 'ready' : 'unpermitted';
    this.callbacks.onStateChange(this.state, rc(this.permissionGranted ? 'roha.microphoneReady' : 'roha.voiceUnpermitted', this.locale));
  }

  public setEchoMute(muted: boolean): void {
    this.isEchoMuted = muted;
    if (muted) {
      this.releaseRecognition();
      this.state = 'speaking';
      this.callbacks.onStateChange('speaking');
    } else if (this.permissionGranted && this.autoRestart) {
      this.scheduleRestart();
    } else {
      this.state = this.permissionGranted ? 'ready' : 'unpermitted';
      this.callbacks.onStateChange(this.state);
    }
  }

  public destroy(): void {
    this.generation++;
    this.permissionRequest = null;
    this.autoRestart = false;
    this.permissionGranted = false;
    this.isEchoMuted = false;
    this.releaseRecognition();
    this.state = 'unpermitted';
  }

  private releaseRecognition(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.recognition) {
      const previous = this.recognition;
      this.recognition = null;
      previous.onresult = previous.onerror = previous.onend = null;
      try { previous.abort(); } catch { /* already stopped */ }
    }
    this.running = false;
  }

  private scheduleRestart(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.autoRestart && !this.isEchoMuted && this.permissionGranted) this.startListening(true, false);
    }, 150);
  }

  private initRecognition(Recognition: any): void {
    const recognition = new Recognition();
    this.recognition = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = this.locale;
    const active = () => this.recognition === recognition && this.permissionGranted && !this.isEchoMuted;

    recognition.onresult = (event: any) => {
      if (!active()) return;
      let finalText = '', interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interimText += event.results[i][0].transcript;
      }
      if (finalText.trim()) {
        this.state = 'processing';
        this.callbacks.onStateChange('processing', rc('roha.processing', this.locale));
        this.callbacks.onTranscript(finalText, true);
      } else if (interimText) {
        this.callbacks.onTranscript(interimText, false);
      }
    };
    recognition.onerror = (event: any) => {
      if (!active() || event.error === 'aborted' || event.error === 'no-speech') return;
      this.autoRestart = false;
      this.releaseRecognition();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.permissionGranted = false;
        this.state = 'unpermitted';
        this.callbacks.onStateChange('unpermitted', rc('roha.microphoneDenied', this.locale));
      } else {
        this.state = 'error';
        this.callbacks.onStateChange('error');
        this.callbacks.onError(rc(event.error === 'network' ? 'roha.voiceNetwork' : 'roha.voiceInputError', this.locale));
      }
    };
    recognition.onend = () => {
      this.running = false;
      if (this.recognition !== recognition) return;
      if (this.autoRestart && !this.isEchoMuted && this.permissionGranted) {
        this.scheduleRestart();
      } else if (!this.isEchoMuted) {
        this.state = 'ready';
        this.callbacks.onStateChange('ready');
      }
    };
  }
}
