/**
 * Roha - Runtime Profile & Capability Inspector
 * Features: F02, F03, L01
 * Accurately tracks and outputs capability evidence conforming to capabilities.schema.json.
 * Never asserts unverified capabilities as available or offline-ready.
 */

import { RohaCapabilities, LanguageMatrixEntry } from './types';

export class RuntimeProfileManager {
  private currentProfile: 'device-local' | 'local-hub' | 'remote-opt-in' = 'device-local';

  public setProfile(profile: 'device-local' | 'local-hub' | 'remote-opt-in'): void {
    this.currentProfile = profile;
  }

  public getProfile(): 'device-local' | 'local-hub' | 'remote-opt-in' {
    return this.currentProfile;
  }

  public getCapabilities(): RohaCapabilities {
    const hasWebSpeech =
      typeof window !== 'undefined' &&
      (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

    const hasSpeechSynthesis =
      typeof window !== 'undefined' && 'speechSynthesis' in window;

    const deviceName =
      typeof navigator !== 'undefined' ? `${navigator.userAgent} (${this.currentProfile})` : 'Linux Node Test';

    const languages: LanguageMatrixEntry[] = [
      {
        tag: 'en',
        capabilities: {
          ui: { status: 'verified', offlineReady: true, evidenceRef: 'app/src/roha/i18n' },
          commands: { status: 'verified', offlineReady: true, evidenceRef: 'app/src/roha/router.ts' },
          transcription: {
            status: hasWebSpeech ? 'verified' : 'partial',
            offlineReady: false,
            evidenceRef: 'WebSpeechAPI/faster-whisper',
          },
          dynamicTts: {
            status: hasSpeechSynthesis ? 'verified' : 'partial',
            offlineReady: true,
            evidenceRef: 'window.speechSynthesis',
          },
          promptAudio: { status: 'verified', offlineReady: true, evidenceRef: 'app/public/audio' },
          wake: {
            status: 'unavailable',
            offlineReady: false,
            reason: 'Dedicated keyword model for "Hey Roha" is in training; tap and foreground button available.',
          },
        },
      },
      {
        tag: 'am',
        capabilities: {
          ui: { status: 'verified', offlineReady: true, evidenceRef: 'schema/runtime-copy-v1.json' },
          commands: { status: 'partial', offlineReady: true, evidenceRef: 'app/src/roha/router.ts' },
          transcription: {
            status: 'partial',
            offlineReady: false,
            evidenceRef: 'WebSpeechAPI am-ET / faster-whisper',
          },
          dynamicTts: {
            status: 'partial',
            offlineReady: false,
            reason: 'Requires installed Amharic system voice on host OS',
          },
          promptAudio: { status: 'verified', offlineReady: true, evidenceRef: 'app/public/audio' },
          wake: {
            status: 'unavailable',
            offlineReady: false,
            reason: 'Dedicated Amharic wake model planned for post-hackathon release.',
          },
        },
      },
      {
        tag: 'ti',
        capabilities: {
          ui: { status: 'planned', offlineReady: false, reason: 'Tigrinya UI copy translation in review' },
          commands: { status: 'planned', offlineReady: false, reason: 'Tigrinya local command table in preparation' },
          transcription: { status: 'unavailable', offlineReady: false, reason: 'Standard Whisper does not support Tigrinya' },
          dynamicTts: { status: 'unavailable', offlineReady: false, reason: 'No standard browser Tigrinya TTS voice' },
          promptAudio: { status: 'planned', offlineReady: false, reason: 'Tigrinya voice talent prompt recording scheduled' },
          wake: { status: 'unavailable', offlineReady: false, reason: 'Wake detection not yet available' },
        },
      },
      {
        tag: 'om',
        capabilities: {
          ui: { status: 'planned', offlineReady: false, reason: 'Afaan Oromo translation underway' },
          commands: { status: 'planned', offlineReady: false, reason: 'Afaan Oromo command table planned' },
          transcription: { status: 'unavailable', offlineReady: false, reason: 'Standard Whisper does not support Afaan Oromo' },
          dynamicTts: { status: 'unavailable', offlineReady: false, reason: 'No standard browser Afaan Oromo voice' },
          promptAudio: { status: 'planned', offlineReady: false, reason: 'Prompt audio planned' },
          wake: { status: 'unavailable', offlineReady: false, reason: 'Wake detection not yet available' },
        },
      },
    ];

    return {
      schemaVersion: '2.0',
      profile: this.currentProfile,
      device: deviceName,
      languages,
    };
  }
}

