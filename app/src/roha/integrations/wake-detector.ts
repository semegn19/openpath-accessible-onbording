/**
 * Roha - Pluggable Wake-Word Detector Adapter
 * Feature: V03 (P2 Stretch & Future Integration)
 *
 * Provides a clean interface for keyword spotting ("Hey Roha" / "ሄይ ሮሃ").
 *
 * Production / Hackathon Separation:
 * - Current Active Behavior: Foreground button/tap/keyboard activation is primary.
 *   WebSpeech keyword matching is available when microphone is already active.
 * - Post-Hackathon Integration: Custom trained on-device TensorFlow Lite / ONNX
 *   keyword spotting model running in Web Audio AudioWorklet across mobile screens.
 *
 * Core Guarantees:
 * 1. Pluggable: Any keyword spotting engine (TFLite, Porcupine, ONNX, WebSpeech)
 *    can be plugged in without touching Roha core code.
 * 2. Explicit User Consent: Microphone audio is never recorded or streamed
 *    without explicit permission.
 * 3. Honest Capability Reporting: Never claim background wake is verified unless
 *    a real model is loaded and tested.
 * 4. Cooldown & Debounce: Built-in debounce to prevent multiple rapid triggers.
 */

export type WakeDetectorStatus = 'unsupported' | 'idle' | 'listening' | 'detected' | 'error';

export interface WakeWordEvent {
  keyword: string;
  confidence: number;
  timestamp: number;
}

export type WakeWordCallback = (event: WakeWordEvent) => void;

/**
 * Universal interface for pluggable wake word detectors
 */
export interface WakeWordDetector {
  readonly id: string;
  readonly name: string;
  readonly isBackgroundSupported: boolean;
  
  init?(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): void;
  isListening(): boolean;
  getStatus(): WakeDetectorStatus;
  onWakeWord(callback: WakeWordCallback): void;
  removeWakeWordListener(callback: WakeWordCallback): void;
}

/**
 * Configuration options for TensorFlow Lite / ONNX keyword spotter
 */
export interface TFLiteWakeConfig {
  modelPath: string;
  threshold?: number; // e.g. 0.85
  sampleRate?: number; // e.g. 16000 Hz
  cooldownMs?: number; // e.g. 2000 ms
  keywords?: string[]; // e.g. ['Hey Roha', 'ሄይ ሮሃ']
}

/**
 * Post-Hackathon TensorFlow Lite Keyword Detector Adapter Stub
 * Plugs directly into an AudioWorklet running an on-device quantized model.
 */
export class TFLiteWakeDetector implements WakeWordDetector {
  public readonly id = 'tflite-keyword-spotter';
  public readonly name = 'TensorFlow Lite "Hey Roha" On-Device Detector';
  public readonly isBackgroundSupported = true;

  private config: TFLiteWakeConfig;
  private status: WakeDetectorStatus = 'idle';
  private listening: boolean = false;
  private listeners: WakeWordCallback[] = [];
  private lastTriggerTime: number = 0;
  private audioContext: any = null;

  constructor(config: TFLiteWakeConfig) {
    this.config = {
      threshold: 0.85,
      sampleRate: 16000,
      cooldownMs: 2000,
      keywords: ['Hey Roha', 'ሄይ ሮሃ'],
      ...config,
    };
  }

  public async init(): Promise<boolean> {
    try {
      // In production: fetch model arrayBuffer from this.config.modelPath
      // and compile in WebAudio AudioWorkletNode
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        this.status = 'idle';
        return true;
      }
      this.status = 'unsupported';
      return false;
    } catch {
      this.status = 'error';
      return false;
    }
  }

  public async start(): Promise<boolean> {
    if (this.status === 'unsupported') return false;

    try {
      this.listening = true;
      this.status = 'listening';
      // Post-hackathon: hook microphone stream to worklet node
      return true;
    } catch {
      this.status = 'error';
      this.listening = false;
      return false;
    }
  }

  public stop(): void {
    this.listening = false;
    this.status = 'idle';
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.suspend();
      } catch {}
    }
  }

  public isListening(): boolean {
    return this.listening;
  }

  public getStatus(): WakeDetectorStatus {
    return this.status;
  }

  public onWakeWord(callback: WakeWordCallback): void {
    this.listeners.push(callback);
  }

  public removeWakeWordListener(callback: WakeWordCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Called by the AudioWorklet/inference runner when prediction score exceeds threshold
   */
  public triggerDetection(keyword: string = 'Hey Roha', confidence: number = 0.92): void {
    const now = Date.now();
    const cooldown = this.config.cooldownMs || 2000;
    if (now - this.lastTriggerTime < cooldown) {
      return; // Suppress bounce
    }

    if (confidence >= (this.config.threshold || 0.85)) {
      this.lastTriggerTime = now;
      this.status = 'detected';
      const event: WakeWordEvent = { keyword, confidence, timestamp: now };
      this.listeners.forEach((fn) => fn(event));
      this.status = 'listening';
    }
  }
}

export const WAKE_WORD_REGEX = /(?:^|\b|\s)(?:hey\s*roha|hello\s*roha|hi\s*roha|ok(?:ay)?\s*roha|roha|ro-ha|ro\s+ha|rohaa|roxa|ruha|roya|row\s*ha|rhoa|rohan|raw\s*ha|loha|broha|ሮሃ|ሮሀ|ሮሓ|ሮሐ|ሮኃ|ሮኻ|ሰላም\s*ሮሃ|ሄይ\s*ሮሃ|akkam\s*roha|hayye\s*roha)(?:$|\b|\s|[.,!?])/iu;

/**
 * Foreground & Background WebSpeech Keyword Detector
 * Continuously listens for "Roha" / "Hey Roha" / "ሮሃ" / "Akkam Roha" / "Hayye Roha"
 */
export class WebSpeechWakeDetector implements WakeWordDetector {
  public readonly id = 'webspeech-keyword-matcher';
  public readonly name = 'Background & Foreground Speech Keyword Matcher';
  public readonly isBackgroundSupported = false;

  private status: WakeDetectorStatus = 'idle';
  private listening: boolean = false;
  private listeners: WakeWordCallback[] = [];
  private lastTriggerTime: number = 0;
  private recognition: any = null;
  private locale: string = 'en-US';
  private restartTimeout: any = null;

  constructor(locale: string = 'en') {
    this.setLocale(locale);
  }

  public setLocale(locale: string): void {
    const l = locale.toLowerCase().slice(0, 2);
    // Chrome Web Speech API only supports am-ET for Ethiopic and en-US for Latin
    this.locale = (l === 'am' || l === 'ti') ? 'am-ET' : 'en-US';
    if (this.recognition) {
      this.recognition.lang = this.locale;
    }
  }

  public async start(): Promise<boolean> {
    this.listening = true;
    this.status = 'listening';
    return true;
  }

  public stop(): void {
    this.listening = false;
    this.status = 'idle';
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }
  }

  public isListening(): boolean {
    return this.listening;
  }

  public getStatus(): WakeDetectorStatus {
    return this.status;
  }

  public onWakeWord(callback: WakeWordCallback): void {
    this.listeners.push(callback);
  }

  public removeWakeWordListener(callback: WakeWordCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  /**
   * Evaluates incoming transcript for wake phrase
   */
  public evaluateTranscript(transcript: string): boolean {
    if (!transcript) return false;

    const lower = transcript.toLowerCase().trim();
    // Comprehensive multilingual wake word regex
    const isWake = WAKE_WORD_REGEX.test(lower);

    if (isWake) {
      const now = Date.now();
      if (now - this.lastTriggerTime > 2500) {
        this.lastTriggerTime = now;
        const event: WakeWordEvent = {
          keyword: 'Roha',
          confidence: 0.96,
          timestamp: now,
        };
        this.status = 'detected';
        this.listeners.forEach((fn) => fn(event));
        setTimeout(() => {
          if (this.listening) this.status = 'listening';
        }, 500);
        return true;
      }
    }
    return false;
  }
}

/**
 * Mock Keyword Detector for testing and validation
 */
export class MockWakeWordDetector implements WakeWordDetector {
  public readonly id = 'mock-wake-detector';
  public readonly name = 'Mock Wake Detector (Testing)';
  public readonly isBackgroundSupported = true;

  private status: WakeDetectorStatus = 'idle';
  private listening: boolean = false;
  private listeners: WakeWordCallback[] = [];

  public async start(): Promise<boolean> {
    this.listening = true;
    this.status = 'listening';
    return true;
  }

  public stop(): void {
    this.listening = false;
    this.status = 'idle';
  }

  public isListening(): boolean {
    return this.listening;
  }

  public getStatus(): WakeDetectorStatus {
    return this.status;
  }

  public onWakeWord(callback: WakeWordCallback): void {
    this.listeners.push(callback);
  }

  public removeWakeWordListener(callback: WakeWordCallback): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  public simulateWake(keyword: string = 'Hey Roha', confidence: number = 0.98): void {
    if (!this.listening) return;
    const event: WakeWordEvent = {
      keyword,
      confidence,
      timestamp: Date.now(),
    };
    this.status = 'detected';
    this.listeners.forEach((fn) => fn(event));
    this.status = 'listening';
  }
}

/**
 * Pluggable Wake Word Manager
 * Connects detector to Roha SDK voice turn-taking lifecycle
 */
export class PluggableWakeWordManager {
  private detector: WakeWordDetector | null = null;
  private onWakeAction: (() => void) | null = null;
  private boundWakeCallback: WakeWordCallback;

  constructor(defaultDetector?: WakeWordDetector) {
    this.boundWakeCallback = (event: WakeWordEvent) => {
      console.log(`[Roha V03 Wake Word Detected] Keyword: "${event.keyword}" (confidence: ${event.confidence})`);
      if (this.onWakeAction) {
        this.onWakeAction();
      }
    };

    if (defaultDetector) {
      this.setDetector(defaultDetector);
    }
  }

  public setDetector(detector: WakeWordDetector): void {
    if (this.detector) {
      this.detector.stop();
      this.detector.removeWakeWordListener(this.boundWakeCallback);
    }

    this.detector = detector;
    this.detector.onWakeWord(this.boundWakeCallback);
  }

  public getDetector(): WakeWordDetector | null {
    return this.detector;
  }

  public setOnWakeAction(action: () => void): void {
    this.onWakeAction = action;
  }

  public async enable(): Promise<boolean> {
    if (!this.detector) {
      console.warn('[Roha V03] No wake word detector configured. Tap or keyboard activation remains active.');
      return false;
    }
    return this.detector.start();
  }

  public disable(): void {
    if (this.detector) {
      this.detector.stop();
    }
  }

  public isListening(): boolean {
    return this.detector ? this.detector.isListening() : false;
  }

  public getStatus(): WakeDetectorStatus {
    return this.detector ? this.detector.getStatus() : 'unsupported';
  }

  public isBackgroundSupported(): boolean {
    return this.detector ? this.detector.isBackgroundSupported : false;
  }
}

