// The speech engine path: /api/transcribe through a fake engine, and the browser handing over to
// it when the browser has no model of its own (which is always the case for Amharic).
import { chromium } from 'playwright';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ASR_PORT = 8093;
const API_OK = 8094;      // with an engine configured
const API_BARE = 8095;    // without one
let fail = 0;
const ok = (c, label, extra = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- a fake speech engine: accepts multipart, answers with text ---------- */
let engineCalls = 0;
const engine = http.createServer((req, res) => {
  let bytes = 0;
  req.on('data', (c) => { bytes += c.length; });
  req.on('end', () => {
    engineCalls++;
    const said = bytes > 500_000 ? '' : 'ሳራ በቀለ';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text: said, engine: 'fake-whisper', bytes }));
  });
});
await new Promise((r) => engine.listen(ASR_PORT, '127.0.0.1', r));

const mk = (port, env = {}) => spawn('node', ['../api/server.mjs'], {
  env: {
    ...process.env, PORT: String(port),
    DATA_DIR: mkdtempSync(join(tmpdir(), `openpath-asr-${port}-`)),
    SCHEMA_DIR: new URL('../../schema', import.meta.url).pathname,
    RATE_LIMIT_PER_MIN: '1000', TRUST_PROXY: '0', ...env,
  },
  stdio: 'ignore',
});
const withEngine = mk(API_OK, { ASR_URL: `http://127.0.0.1:${ASR_PORT}/inference` });
const withoutEngine = mk(API_BARE);
const stop = () => { withEngine.kill('SIGKILL'); withoutEngine.kill('SIGKILL'); engine.close(); };
process.on('exit', stop);

for (const port of [API_OK, API_BARE]) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* booting */ }
    await wait(100);
  }
}

const audio = new Uint8Array(20_000).fill(7);

/* ---------- 1. health tells an operator the truth ---------- */
const healthOk = await (await fetch(`http://127.0.0.1:${API_OK}/api/health`)).json();
const healthBare = await (await fetch(`http://127.0.0.1:${API_BARE}/api/health`)).json();
ok(healthOk.transcription === 'configured', 'health reports transcription: configured');
ok(healthBare.transcription === 'none', 'health reports transcription: none when ASR_URL is unset');
ok(['aes-256-gcm', 'none'].includes(healthBare.encryption), 'health reports the encryption state', healthBare.encryption);

/* ---------- 2. not configured: a distinct, actionable refusal ---------- */
const bare = await fetch(`http://127.0.0.1:${API_BARE}/api/transcribe`, {
  method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: audio,
});
const bareBody = await bare.json();
ok(bare.status === 503 && bareBody.error?.code === 'asr-not-configured',
   'an unconfigured server says so explicitly', `${bare.status} ${bareBody.error?.code}`);

/* ---------- 3. configured: audio in, text out ---------- */
const good = await fetch(`http://127.0.0.1:${API_OK}/api/transcribe`, {
  method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: audio,
});
const goodBody = await good.json();
ok(good.status === 200 && goodBody.text === 'ሳራ በቀለ', 'audio is transcribed through the configured engine', goodBody.text);
ok(engineCalls === 1, 'the engine was called exactly once');

const wrongType = await fetch(`http://127.0.0.1:${API_OK}/api/transcribe`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"no"}',
});
ok(wrongType.status === 415, 'a non-audio body is refused', String(wrongType.status));

const huge = new Uint8Array(Number(process.env.MAX_AUDIO_BYTES ?? 2 * 1024 * 1024) + 1024);
const tooBig = await fetch(`http://127.0.0.1:${API_OK}/api/transcribe`, {
  method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: huge,
}).catch(() => ({ status: 413 }));
ok([413, 0].includes(tooBig.status), 'oversized audio is refused', String(tooBig.status));

/* ---------- 4. the browser hands over to it when it has no engine at all ---------- */
const site = spawn('node', ['tests/nginx-sim.mjs', '8096'], { env: { ...process.env, API_PORT: String(API_OK) }, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { if ((await fetch('http://127.0.0.1:8096/')).ok) break; } catch { /* booting */ } await wait(100); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, permissions: ['microphone'] });
const page = await ctx.newPage();
// Firefox/Safari situation: no SpeechRecognition. A microphone and a recorder do exist.
await page.addInitScript(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  window.__posted = [];
  const realFetch = window.fetch;
  window.fetch = (url, opts) => {
    if (String(url).includes('/api/transcribe')) window.__posted.push({ type: opts?.headers?.['Content-Type'] ?? '', size: opts?.body?.size ?? 0 });
    return realFetch(url, opts);
  };
  class FakeMR {
    constructor() { this.ondataavailable = null; this.onstop = null; }
    static isTypeSupported() { return true; }
    start() { setTimeout(() => this.ondataavailable?.({ data: new Blob([new Uint8Array(20000)], { type: 'audio/webm' }) }), 20); }
    stop() { setTimeout(() => this.onstop?.(), 30); }
  }
  window.MediaRecorder = FakeMR;
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
});
await page.goto('http://127.0.0.1:8096/onboard', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.getByRole('radio', { name: /አማርኛ/ }).check();
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(150);
await page.getByRole('radio', { name: /አይ፣ ራሴ|No, I will fill it myself/ }).check();
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(200);

const before = engineCalls;
await page.getByRole('button', { name: /በድምጽ|Speak your answer/ }).first().click();
await page.getByRole('button', { name: /ተናገርኩ|I have finished/ }).click({ timeout: 5000 });
await page.waitForTimeout(1200);
const card = (await page.locator('.op-voice-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
const posted = await page.evaluate(() => window.__posted);
ok(posted.length === 1, 'with no browser engine, the mic records and posts to /api/transcribe', JSON.stringify(posted[0] ?? {}));
ok(engineCalls === before + 1, 'the configured engine received it');
ok(/ሳራ በቀለ/.test(card), 'the transcript comes back in the review card, not straight into the field', card.slice(0, 60));
await browser.close();
site.kill('SIGKILL');

console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
