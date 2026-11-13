// Does the CSP we ship in nginx.conf break the app? Any blocked resource is a dead page.
import { chromium } from 'playwright';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8081';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
const problems = [];
p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 140)); });
p.on('pageerror', (e) => problems.push('pageerror: ' + e.message.slice(0, 140)));
p.on('requestfailed', (r) => problems.push('failed: ' + r.url().split('/').pop()));

for (const path of ['/onboard', '/job', '/employer']) {
  await p.goto(ORIGIN + path, { waitUntil: 'networkidle' });
  const alive = await p.locator('h1').first().isVisible();
  console.log(`${alive && !problems.length ? '✓' : '✗'} ${path.padEnd(11)} rendered=${alive} fonts=${await p.evaluate(() => document.fonts.check('600 16px "Noto Sans Ethiopic"'))} problems=${problems.length}`);
}
// fonts must actually load under the CSP (self-hosted, so font-src 'self' should allow them)
await p.goto(ORIGIN + '/onboard', { waitUntil: 'networkidle' });
const loaded = await p.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight);
});
console.log('   fonts loaded:', loaded.join(', ') || '(none)');
if (problems.length) { console.log('\n' + problems.join('\n')); }
await b.close();
process.exit(problems.length ? 1 : 0);
