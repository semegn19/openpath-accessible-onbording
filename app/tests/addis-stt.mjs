import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

const API = process.env.API_URL || 'http://127.0.0.1:8080';

console.log('=== Addis AI STT Live & Policy Verification ===');

// 1. Health check reveals configured transcription and languages
const healthRes = await fetch(`${API}/api/health`);
const health = await healthRes.json();
ok(health.transcription === 'configured', 'health reports transcription: configured');
ok(Array.isArray(health.transcriptionLanguages) && health.transcriptionLanguages.includes('am'), 'health includes am');
ok(health.transcriptionLanguages.includes('om'), 'health includes om');
ok(health.transcriptionLanguages.includes('ti'), 'health includes ti');

// 2. English audio must be refused when Addis AI is the provider
const dummyAudio = readFileSync(fileURLToPath(new URL('../public/audio/phone.am.simple.mp3', import.meta.url)));
const enRes = await fetch(`${API}/api/transcribe?lang=en`, {
  method: 'POST',
  headers: { 'Content-Type': 'audio/mpeg' },
  body: dummyAudio,
});
const enData = await enRes.json();
ok(enRes.status === 422, 'English transcription request is refused by Addis AI provider', `HTTP ${enRes.status}`);
ok(enData.error?.code === 'language-not-supported', 'English rejection has code language-not-supported', enData.error?.code);

// 3. Transcribe Amharic via Addis AI
const amAudio = readFileSync(fileURLToPath(new URL('../public/audio/name.am.simple.mp3', import.meta.url)));
const amRes = await fetch(`${API}/api/transcribe?lang=am`, {
  method: 'POST',
  headers: { 'Content-Type': 'audio/mpeg' },
  body: amAudio,
});
const amData = await amRes.json();
ok(amRes.status === 200, 'Amharic transcription succeeded', `HTTP ${amRes.status}`);
ok(amData.engine === 'addis-ai', 'Amharic engine is addis-ai', amData.engine);
ok(Boolean(amData.text && amData.text.length > 0), 'Amharic returned non-empty transcript', amData.text);

// 4. Transcribe Afaan Oromoo via Addis AI
const omAudio = readFileSync(fileURLToPath(new URL('../public/audio/name.om.simple.mp3', import.meta.url)));
const omRes = await fetch(`${API}/api/transcribe?lang=om`, {
  method: 'POST',
  headers: { 'Content-Type': 'audio/mpeg' },
  body: omAudio,
});
const omData = await omRes.json();
ok(omRes.status === 200, 'Afaan Oromoo transcription succeeded', `HTTP ${omRes.status}`);
ok(omData.engine === 'addis-ai', 'Afaan Oromoo engine is addis-ai', omData.engine);
ok(Boolean(omData.text && omData.text.length > 0), 'Afaan Oromoo returned non-empty transcript', omData.text);

// 5. Transcribe Tigrinya via Addis AI
const tiAudio = readFileSync(fileURLToPath(new URL('../public/audio/name.ti.simple.mp3', import.meta.url)));
const tiRes = await fetch(`${API}/api/transcribe?lang=ti`, {
  method: 'POST',
  headers: { 'Content-Type': 'audio/mpeg' },
  body: tiAudio,
});
const tiData = await tiRes.json();
ok(tiRes.status === 200, 'Tigrinya transcription succeeded', `HTTP ${tiRes.status}`);
ok(tiData.engine === 'addis-ai', 'Tigrinya engine is addis-ai', tiData.engine);
ok(Boolean(tiData.text && tiData.text.length > 0), 'Tigrinya returned non-empty transcript', tiData.text);

if (fail > 0) {
  console.error(`\nFAILED — ${fail} problem(s) in Addis AI STT tests`);
  process.exit(1);
} else {
  console.log(`\nPASS — 0 problem(s) in Addis AI STT tests`);
}
