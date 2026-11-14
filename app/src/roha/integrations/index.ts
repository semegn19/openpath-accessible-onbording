/**
 * Roha - Integrations & Extensibility Hub
 * Exports post-hackathon stretch modules (P2) and pluggable provider adapters:
 * - B01: Partner-Assisted Portal Adapter (AAAPD, LIWAY, NGOs)
 * - B02: SMS Resume Link Gateway (Ethio Telecom, Twilio)
 * - B03: Private Human Support & Video Handoff (WebRTC, Helpdesk)
 * - V03: Always-On Background Wake-Word Detector (TFLite, WebSpeech, Mock)
 */

export * from './partner-portal';
export * from './sms-gateway';
export * from './human-handoff';
export * from './wake-detector';

