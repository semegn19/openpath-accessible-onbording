// End-to-end: the form talks to the real API, and is honest when the API is not there.
import { chromium } from 'playwright';
import { answer, goto, next, submitFromReview, LABELS } from './_flow.mjs';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// NB: do not name this URL — it shadows the global URL constructor used below
const PAGE_URL = process.env.URL || 'http://127.0.0.1:5173/onboard';
const API = 'http://127.0.0.1:8080/api';
let fail = 0;
const ok = (c, label, extra = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

// The dev server proxies /api → 127.0.0.1:8080. Reuse a running API, or start a scratch one.
let child = null;
const up = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
if (!up) {
  child = spawn('node', ['../api/server.mjs'], {
    env: { ...process.env, PORT: '8080', DATA_DIR: mkdtempSync(join(tmpdir(), 'openpath-e2e-')),
           SCHEMA_DIR: new URL('../../schema', import.meta.url).pathname, RATE_LIMIT_PER_MIN: '1000', TRUST_PROXY: '0' },
    stdio: 'ignore', detached: false,
  });
  for (let i = 0; i < 50; i++) { if (await fetch(`${API}/health`).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 100)); }
}
process.on('exit', () => child?.kill('SIGKILL'));

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
/* ---------- 1. with the API: a real reference comes back ---------- */
await goto(p, PAGE_URL);
await answer(p, { assistance: 'call-me' });
await submitFromReview(p);
await p.waitForTimeout(1200);

const h1 = (await p.locator('h1').first().innerText()).trim();
const receipt = (await p.locator('.op-receipt').innerText()).replace(/\s+/g, ' ').trim();
const id = receipt.match(/sub_[A-Za-z0-9_-]{16}/)?.[0];
ok(h1.includes('ተጠናቅቋል') || h1.includes('complete'), 'heading says the sign-up is complete', h1);
ok(!!id, 'a reference number is shown', id);

if (id) {
  const rec = await (await fetch(`${API}/submissions/${id}`)).json();
  ok(rec.answers?.name === 'ሳራ በቀለ ታደሰ', 'the server stored the Amharic name', rec.answers?.name);
  ok(rec.answers?.phone === '+251912345678', 'and normalised the phone', rec.answers?.phone);
  ok(!('support' in (rec.answers ?? {})), 'and never received the support answers');
  console.log('   stored record:', JSON.stringify(rec).slice(0, 150) + '…');
}

/* ---------- 2. without the API: say so, do not pretend ---------- */
await p.route('**/api/**', (route) => route.fulfill({ status: 404, contentType: 'text/html', body: '<!doctype html><p>no api here</p>' }));
await goto(p, PAGE_URL);
await answer(p, { phone: '0911112233' });
await submitFromReview(p);
await p.waitForTimeout(900);
const h1b = (await p.locator('h1').first().innerText()).trim();
const note = (await p.locator('.op-receipt').innerText()).replace(/\s+/g, ' ').trim();
ok(h1b.includes('መሣሪያ') || /device/i.test(h1b), 'no API → heading does NOT claim completion', h1b);
ok(/አልቻልንም|could not reach/.test(note), 'and it explains why, with a next step', note.slice(0, 90));

await b.close();
console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
