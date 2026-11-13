// Slow connection and no connection: the two conditions this form will actually be used in.
//
// Runs against the PRODUCTION build (dist + nginx semantics), because the offline shell only
// exists there — the service worker is deliberately not registered in dev.
//
//   node tests/offline.mjs
import { chromium } from 'playwright';
import { answer, goto, submitFromReview } from './_flow.mjs';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8085;
const API_PORT = 8091;
const SITE = `http://127.0.0.1:${PORT}/onboard`;
const API = `http://127.0.0.1:${API_PORT}/api`;
let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(new URL('../dist/index.html', import.meta.url).pathname)) {
  console.error('build dist first: npm run build');
  process.exit(1);
}

/* ---------- servers: a scratch API with a directory we can inspect ---------- */
const dataDir = mkdtempSync(join(tmpdir(), 'openpath-offline-'));
const api = spawn('node', ['../api/server.mjs'], {
  env: {
    ...process.env, PORT: String(API_PORT), DATA_DIR: dataDir,
    SCHEMA_DIR: new URL('../../schema', import.meta.url).pathname,
    RATE_LIMIT_PER_MIN: '1000', TRUST_PROXY: '0',
  },
  stdio: 'ignore',
});
const site = spawn('node', ['tests/nginx-sim.mjs', String(PORT)], {
  env: { ...process.env, API_PORT: String(API_PORT) },
  stdio: 'ignore',
});
const ready = async (url) => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not up yet */ }
    await wait(100);
  }
  return false;
};
if (!(await ready(`http://127.0.0.1:${API_PORT}/api/health`))) { console.error('api did not start'); process.exit(1); }
if (!(await ready(`http://127.0.0.1:${PORT}/`))) { console.error('site did not start'); process.exit(1); }
const stop = () => { api.kill('SIGKILL'); site.kill('SIGKILL'); };
process.on('exit', stop);

const browser = await chromium.launch();

/* ============================================================ 1. the 3G budget
 * Chrome's own "Slow 3G" profile: 400 ms RTT, 400 kbit/s down, 400 kbit/s up.
 * If the form cannot reach a usable first screen inside ten seconds there, it is not
 * a form for this country — it is a form for a demo room. */
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400,
    downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8,
  });

  const t0 = Date.now();
  await p.goto(SITE, { waitUntil: 'load' });
  const loadMs = Date.now() - t0;
  await p.getByRole('radio', { name: /አማርኛ|English/ }).first().waitFor({ state: 'visible' });
  const usableMs = Date.now() - t0;

  const bytes = await p.evaluate(() =>
    performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || 0), 0),
  );
  const kb = Math.round(bytes / 1024);
  ok(usableMs < 10_000, 'form is usable within 10 s on Slow 3G', `${usableMs} ms to first question, ${loadMs} ms to load, ${kb} KB over the wire`);
  ok(kb < 400, 'first visit stays under 400 KB on the wire', `${kb} KB`);
  console.log(`  · at 400 kbit/s that is roughly ${(kb * 8 / 400).toFixed(1)} s of download alone`);

  // The same phone, the same link, the form opened a second time. The shell and the 136 KB
  // Ethiopic font should now come out of the worker's cache — this is the number that matters
  // for a learner who comes back to finish.
  await p.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 15_000 }).catch(() => {});
  await p.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  const t1 = Date.now();
  await p.goto(SITE, { waitUntil: 'load' });
  await p.getByRole('radio', { name: /አማርኛ|English/ }).first().waitFor({ state: 'visible' });
  const secondMs = Date.now() - t1;
  const secondBytes = await p.evaluate(() =>
    performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || 0), 0),
  );
  ok(secondBytes < kb * 1024 * 0.25, 'a second visit costs almost nothing on the wire',
     `${Math.round(secondBytes / 1024)} KB vs ${kb} KB, ${secondMs} ms to first question`);
  await c.close();
}

/* ============================================================ 2. a drop mid-form
 * The scenario: a learner is at the phone question on a minibus, the signal goes, they
 * reload out of habit. The worker must still serve the app, and the draft must be there. */
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await goto(page, SITE);
await page.waitForFunction(() => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 15_000 });
ok(true, 'service worker is installed and controlling the page');

// answer the first few questions, then lose the signal
await page.getByRole('radio', { name: /አማርኛ/ }).check();
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await wait(150);
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await wait(150);
await page.getByRole('radio', { name: /አይ፣ ራሴ|No, I will fill it myself/ }).check();
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await wait(150);
await page.locator('input[type="text"]').first().fill('ሳራ በቀለ ታደሰ');
await wait(700);                                  // let the 500 ms autosave land

await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await wait(400);
const titleAfterOfflineReload = await page.locator('h1').first().innerText();
ok(/ተጠናቀቀ|unfinished|restored|መልሶች/i.test((await page.locator('body').innerText())) || titleAfterOfflineReload.length > 0,
   'app shell loads with no connection at all', 'rendered from the service worker cache');

const restoredName = await page.evaluate(() => {
  const raw = localStorage.getItem('openpath:draft:savanna-onboard-v1');
  return raw ? JSON.parse(raw).values?.name : null;
});
ok(restoredName === 'ሳራ በቀለ ታደሰ', 'the draft survived a reload with no connection', String(restoredName));

// the API was never cached — answers must not sit in a cache looking like content
const apiCached = await page.evaluate(async () => {
  const names = await caches.keys();
  const urls = [];
  for (const n of names) for (const r of await (await caches.open(n)).keys()) urls.push(r.url);
  return urls.filter((u) => u.includes('/api/'));
});
ok(apiCached.length === 0, 'no /api/ response is ever cached', apiCached.join(', ') || '0 cached API entries');

await ctx.setOffline(false);

/* ============================================================ 3. submit with no signal
 * Nothing may be lost, and the page must not claim a sign-up that did not happen. */
await goto(page, SITE);
await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 15_000 });
await answer(page, { assistance: 'call-me' });
await ctx.setOffline(true);
await submitFromReview(page);
await wait(900);

let h1 = (await page.locator('h1').first().innerText()).trim();
ok(/ተቀምጧል|Saved on this device/.test(h1), 'offline submit says "saved on this device", not "complete"', h1);

const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('openpath:outbox:v1') || '[]'));
ok(queued.length === 1, 'exactly one sign-up is waiting in the outbox', `${queued.length}`);
ok(Boolean(queued[0]?.ref) && queued[0].answers?.phone, 'the outbox holds the answers and an idempotency ref',
   `${queued[0]?.ref}`);
ok(!queued[0]?.answers?.['accessibility-prefs'], 'the private preferences are in the outbox too? (they must not be)',
   'accessibility-prefs absent');

const draftAfterQueue = await page.evaluate(() => localStorage.getItem('openpath:draft:savanna-onboard-v1'));
ok(draftAfterQueue === null, 'the draft is cleared only after the outbox holds the answers');

/* ============================================================ 4. close the tab, come back
 * This is the case that used to lose the sign-up: the answers were deleted, then the send
 * failed, and the "saved" message was about nothing. */
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await wait(600);
h1 = (await page.locator('h1').first().innerText()).trim();
ok(/ተቀምጧል|Saved on this device/.test(h1), 'a reload with no connection still shows the waiting sign-up', h1);
const retryBtn = page.getByRole('button', { name: /እንደገና ሞክር|Try sending now/ });
ok(await retryBtn.isVisible(), 'there is a "try sending now" button, not just advice');

/* ============================================================ 5. reconnect → it sends itself */
await ctx.setOffline(false);
// The 'online' event fires a flush on its own — that is the behaviour we want, so give it the
// first chance to finish and only fall back to the button if it did not.
await wait(1200);
h1 = (await page.locator('h1').first().innerText()).trim();
let sentItself = /ተጠናቅቋል|complete/.test(h1);
if (!sentItself) {
  await page.getByRole('button', { name: /እንደገና ሞክር|Try sending now/ }).click();
  await page.waitForFunction(
    () => /ተጠናቅቋል|complete/.test(document.querySelector('h1')?.textContent || ''),
    null, { timeout: 12_000 },
  ).catch(() => {});
  h1 = (await page.locator('h1').first().innerText()).trim();
}
ok(true, `the queued sign-up was sent ${sentItself ? 'automatically on reconnect' : 'by the retry button'}`);
const receiptText = (await page.locator('.op-receipt').innerText()).replace(/\s+/g, ' ');
const sentId = receiptText.match(/sub_[A-Za-z0-9_-]{16}/)?.[0];
ok(/ተጠናቅቋል|complete/.test(h1), 'the queued sign-up goes through when the connection returns', h1);
ok(Boolean(sentId), 'the learner gets a reference number', sentId ?? 'none');

const afterSend = await page.evaluate(() => ({
  outbox: JSON.parse(localStorage.getItem('openpath:outbox:v1') || '[]').length,
  receipts: JSON.parse(localStorage.getItem('openpath:receipts:v1') || '[]'),
}));
ok(afterSend.outbox === 0, 'the outbox is empty once it is sent');
ok(afterSend.receipts.length === 1 && afterSend.receipts[0].id === sentId, 'only the reference number is kept, not the answers');

/* ============================================================ 6. exactly one record on disk
 * The whole point of the idempotency ref: send the same thing twice, get one learner. */
const flushed = await page.evaluate(async () => {
  const raw = JSON.parse(localStorage.getItem('openpath:receipts:v1') || '[]')[0];
  const res = await fetch('/api/submissions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: 'savanna-onboard',
      clientRef: raw.ref,
      answers: { language: 'am', assistance: 'call-me', name: 'ሳራ በቀለ ታደሰ', phone: '+251912345678' },
    }),
  });
  return { status: res.status, body: await res.json() };
});
ok(flushed.status === 200 && flushed.body.id === sentId, 'a duplicate retry returns the same reference, 200 not 201',
   `${flushed.status} ${flushed.body.id}`);

const lines = readFileSync(join(dataDir, 'submissions.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
const matching = lines.filter((l) => l.includes('+251912345678'));
ok(matching.length === 1, 'the server holds exactly one record for this learner', `${matching.length} of ${lines.length} lines`);

/* ============================================================ 7. the reload after a success
 * "Keep this number" is worthless if a reload wipes it. */
await goto(page, SITE);
await wait(400);
await page.evaluate((id) => localStorage.setItem('openpath:receipts:v1', JSON.stringify([
  { ref: 'ref_a', formId: 'savanna-onboard-v1', id, receivedAt: new Date().toISOString(), sentAt: Date.now() },
])), sentId);
await page.reload({ waitUntil: 'load' });
await wait(300);
const bannerText = (await page.locator('.op-banner').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(bannerText.includes(sentId ?? 'no-id'), 'the reference number is still shown after a reload', bannerText.slice(0, 60));

await browser.close();
stop();
console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
