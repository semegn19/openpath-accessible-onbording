// One form per page, at a real path: /onboard, /job, /employer. No top navigation.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:5173';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
let fail = 0;
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

const axe = async (label) => {
  const { violations } = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  if (bad.length) fail++;
  console.log(`${bad.length ? '✗' : '✓'} ${label.padEnd(24)} serious/critical: ${bad.length}${bad.length ? ' → ' + bad.map((v) => v.id) : ''}`);
};

const PAGES = [
  ['/onboard', 'የተማሪ ምዝገባ', 'ቋንቋ ይምረጡ'],
  ['/job', 'ለሥራ ማመልከቻ', null],
  ['/employer', 'ድርጅት ምዝገባ', null],
];

for (const [path, brand, firstQuestion] of PAGES) {
  const res = await p.goto(ORIGIN + path, { waitUntil: 'networkidle' });
  const got = (await p.locator('.op-brand').innerText()).trim();
  const h1 = (await p.locator('h1').first().innerText()).trim();
  ok(res.status() === 200 && got === brand, `GET ${path}`, `${res.status()} "${got}"`);
  ok(await p.locator('.op-forms, nav').count() === 0, `  no top navigation on ${path}`);
  ok((await p.title()).startsWith(brand), `  page title`, await p.title());
  ok((await p.evaluate(() => location.pathname)) === path, `  address bar stays`, await p.evaluate(() => location.pathname));
  if (firstQuestion) ok(h1 === firstQuestion, '  first question', h1);
  await axe(`page ${path}`);
}

// bare domain → a real page URL, not a bare "/"
await p.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
ok((await p.evaluate(() => location.pathname)) === '/onboard', 'bare domain → /onboard', await p.evaluate(() => location.pathname));

// an old #/job link that someone already shared keeps working, and is cleaned up
await p.goto(ORIGIN + '/#/job', { waitUntil: 'networkidle' });
ok((await p.locator('.op-brand').innerText()).trim() === 'ለሥራ ማመልከቻ', 'old #/job link still works');
ok((await p.evaluate(() => location.pathname + location.hash)) === '/job', '  and is rewritten to /job', await p.evaluate(() => location.pathname + location.hash));

// the skip link must not be mistaken for a route change
await p.goto(ORIGIN + '/employer', { waitUntil: 'networkidle' });
await p.keyboard.press('Tab');
const firstTab = await p.evaluate(() => document.activeElement?.textContent?.trim());
await p.keyboard.press('Enter');
await p.waitForTimeout(200);
const after = await p.evaluate(() => ({ focus: document.activeElement?.id, path: location.pathname, brand: document.querySelector('.op-brand')?.textContent?.trim() }));
ok(after.focus === 'op-main' && after.path === '/employer' && after.brand === 'ድርጅት ምዝገባ',
   'skip link keeps the page', `tab="${firstTab}" focus=${after.focus} path=${after.path}`);

// back/forward across pages
await p.goto(ORIGIN + '/onboard', { waitUntil: 'networkidle' });
await p.goto(ORIGIN + '/job', { waitUntil: 'networkidle' });
await p.goBack(); await p.waitForTimeout(300);
ok((await p.locator('.op-brand').innerText()).trim() === 'የተማሪ ምዝገባ', 'browser back', await p.evaluate(() => location.pathname));

await b.close();
console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
