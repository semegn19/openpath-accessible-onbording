// Smoke + axe on every screen of the onboarding flow. `node tests/a11y.spec.mjs`
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.URL || 'http://127.0.0.1:5173/';
const results = [];
let failures = 0;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('pageerror', (e) => { console.log('  PAGE ERROR:', e.message); failures++; });
page.on('console', (m) => { if (m.type() === 'error') console.log('  console.error:', m.text().slice(0, 200)); });

async function audit(label) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  const minor = violations.filter((v) => !['critical', 'serious'].includes(v.impact));
  results.push({ label, serious: serious.length, minor: minor.length, ids: serious.map((v) => v.id) });
  if (serious.length) failures++;
  console.log(`${serious.length ? '✗' : '✓'} ${label.padEnd(34)} serious/critical: ${serious.length}  other: ${minor.length}` +
    (serious.length ? `  → ${serious.map((v) => v.id).join(', ')}` : '') +
    (minor.length ? `  (${minor.map((v) => v.id).join(', ')})` : ''));
}

const h1 = () => page.locator('h1').first().innerText();
const next = () => page.getByRole('button', { name: /ቀጣይ|Next/ }).click();

await page.goto(URL, { waitUntil: 'networkidle' });
console.log('\n=== 1 language ===');
console.log('  h1:', (await h1()).trim());
console.log('  focused:', await page.evaluate(() => document.activeElement?.tagName));
await audit('1 language');

// The language question can no longer be left blank: the form is always in some language, so the
// radio starts on the one in use. The error state is therefore exercised on a required text field
// (see "name" below) rather than here.
await next();
await page.waitForTimeout(200);

console.log('\n=== 2 accessibility preferences (local only) ===');
console.log('  h1:', (await h1()).trim());
await audit('2 accessibility prefs');
const prefs = page.locator('.op-fieldset').first();
await prefs.getByRole('checkbox').nth(1).check();          // bigger text
await page.waitForTimeout(150);
const bigOn = await page.evaluate(() => document.querySelector('.op-shell')?.getAttribute('data-big'));
console.log('  prefs→settings wiring (data-big):', bigOn);
await prefs.getByRole('checkbox').nth(1).uncheck();
await audit('2b prefs selected');
await next();
await page.waitForTimeout(200);

console.log('\n=== 3 name ===');
console.log('  h1:', (await h1()).trim());
await audit('3 name');

// error path: press Next with the required field empty
await next();
await page.waitForTimeout(250);
const summaryVisible = await page.locator('.op-error-summary').isVisible().catch(() => false);
const focusedAfterError = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
console.log('  empty name → summary visible:', summaryVisible, '| focus on:', focusedAfterError);
await audit('3b error state');

await page.locator('input[type="text"]').first().fill('ሳራ በቀለ ታደሰ');
await next();
await page.waitForTimeout(200);

console.log('\n=== 4 phone ===');
console.log('  h1:', (await h1()).trim());
await audit('4 phone');
await page.locator('input[type="tel"]').fill('0912345678');
await next();
await page.waitForTimeout(200);

console.log('\n=== 5 identity route (four options) ===');
console.log('  h1:', (await h1()).trim());
const routeOptions = await page.locator('.op-fieldset input[type="radio"]').count();
console.log('  routes offered:', routeOptions);
await audit('5 id-route');
await page.getByRole('radio', { name: /የፋይዳ|Fayda/ }).check();
await next();
await page.waitForTimeout(200);

console.log('\n=== 6 id number (conditional) ===');
console.log('  h1:', (await h1()).trim());
await audit('6 id value');
await page.locator('input[type="text"]').first().fill('3910028475');

// go back and switch route to kebele: tests conditional switch to file upload
await page.getByRole('button', { name: /ተመለስ|Back/ }).click();
await page.waitForTimeout(200);
await page.getByRole('radio', { name: /የቀበሌ|Kebele/ }).check();
await next();
await page.waitForTimeout(200);

console.log('\n=== 6b id document photo (conditional, file upload) ===');
console.log('  h1:', (await h1()).trim());
const micOnFile = await page.getByRole('button', { name: /በድምጽ መስጠት|Speak your answer/ }).count();
const readOnFile = await page.getByRole('button', { name: /ያዳምጡ|አንብብልኝ|Read the question/ }).count();
console.log('  voice button on file (must be 0):', micOnFile, '| read-aloud (must be 1):', readOnFile);
if (micOnFile !== 0) failures++;
if (readOnFile !== 1) failures++;
await audit('6b file upload');
await next();
await page.waitForTimeout(200);

console.log('\n=== 7 review ===');
console.log('  h1:', (await h1()).trim());
const reviewRows = await page.locator('.op-review-row').count();
const showsIdNumber = (await page.locator('.op-review').innerText().catch(() => '')).includes('3910028475');
console.log('  review rows:', reviewRows, '| stale ID number shown (must be false):', showsIdNumber);
if (showsIdNumber) failures++;
await audit('7 review');

await page.setViewportSize({ width: 320, height: 640 });
await page.waitForTimeout(150);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log('\n  320px reflow → horizontal scroll:', overflow);
if (overflow) failures++;
await audit('7b review @320px');

// 200% zoom — the gate names it explicitly, so it is measured, not assumed. A 1280×800
// laptop zoomed to 200% lays out at 640×400 CSS pixels; anything that fits here fits there.
await page.setViewportSize({ width: 640, height: 400 });
await page.waitForTimeout(200);
const zoom = await page.evaluate(() => {
  const clipped = [...document.querySelectorAll('.op-h1, .op-review-row, .op-btn, .op-settingsbar button')]
    .filter((el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
    .map((el) => `${el.className}: "${(el.textContent || '').trim().slice(0, 24)}"`);
  return {
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    clipped,
    h1Visible: (() => { const r = document.querySelector('.op-h1')?.getBoundingClientRect(); return Boolean(r && r.height > 0 && r.top < window.innerHeight); })(),
    fontPx: getComputedStyle(document.querySelector('.op-h1') ?? document.body).fontSize,
  };
});
console.log('\n  200% zoom (640×400) → horizontal scroll:', zoom.hScroll, '| h1 visible:', zoom.h1Visible, '| h1 size:', zoom.fontPx);
if (zoom.clipped.length) console.log('  clipped:', zoom.clipped.join(' | '));
if (zoom.hScroll || !zoom.h1Visible || zoom.clipped.length) failures++;
await audit('7c review @200% zoom');

// Text spacing (SC 1.4.12): the exact overrides from the Understanding document. If the layout
// survives these, it survives any user stylesheet that does the same thing.
await page.setViewportSize({ width: 390, height: 844 });
await page.addStyleTag({ content: `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p, li, h1, h2, h3, label, .op-progress, .op-review-row { margin-bottom: 2em !important; }
` });
await page.waitForTimeout(250);
const spacing = await page.evaluate(() => {
  // .op-sr is the visually-hidden live region: clipping is its job, not a defect.
  const clipped = [...document.querySelectorAll('h1, p, label, button, .op-review-row, .op-hint')]
    .filter((el) => !el.classList.contains('op-sr')
                 && getComputedStyle(el).textOverflow !== 'ellipsis'
                 && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2))
    .map((el) => `${el.tagName}.${el.className}: "${(el.textContent || '').trim().slice(0, 20)}"`);
  return { clipped, hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
console.log('\n  1.4.12 text spacing → horizontal scroll:', spacing.hScroll, '| clipped:', spacing.clipped.length);
if (spacing.clipped.length) console.log('   ', spacing.clipped.slice(0, 5).join(' | '));
if (spacing.hScroll || spacing.clipped.length) failures++;
await audit('7d review @WCAG text spacing');
// switch the overrides off again instead of reloading, so the walk keeps its place
await page.evaluate(() => {
  for (const st of document.querySelectorAll('style')) {
    if (st.textContent?.includes('0.12em')) st.disabled = true;
  }
});
await page.waitForTimeout(150);

await next();
await page.waitForTimeout(200);
console.log('\n=== 8 submit (consent) ===');
console.log('  h1:', (await h1()).trim());
await audit('8 submit');
await page.getByRole('checkbox', { name: /ተስማምቻለሁ|agree/i }).first().check();
await page.getByRole('button', { name: /ምዝገባውን ጨርስ|Finish/ }).click();
await page.waitForTimeout(400);
console.log('\n=== 9 done ===');
console.log('  h1:', (await h1()).trim());
await audit('9 success');

const payload = await page.evaluate(() => document.querySelector('.op-payload')?.textContent ?? '');
const leaksPrefs = payload.includes('accessibility-prefs') || payload.includes('"support"');
const hasName = payload.includes('name');
const hasPhone = payload.includes('phone');
console.log('  payload has accessibility choices (must be false):', leaksPrefs);
console.log('  payload has name and phone (must be true):', hasName && hasPhone);
if (leaksPrefs || !hasName || !hasPhone) failures++;

// the offline banner is new UI, so it is audited like the rest. No reload: the dev server is
// still reachable, we only flip the flag the banner reads.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.context().setOffline(true);
await page.waitForSelector('.op-net', { timeout: 5000 });
const netText = (await page.locator('.op-net').innerText()).replace(/\s+/g, ' ');
const netRole = await page.evaluate(() => {
  const el = document.querySelector('.op-net');
  return { live: el?.closest('[aria-live]') !== null || el?.getAttribute('aria-live') !== null,
           content: el?.textContent?.trim().length ?? 0 };
});
console.log('  offline banner:', netText);
if (!netRole.content) failures++;
await audit('12 offline banner (no connection)');
await page.context().setOffline(false);

// keyboard-only pass
await page.goto(URL, { waitUntil: 'networkidle' });
const order = [];
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Tab');
  order.push(await page.evaluate(() => {
    const el = document.activeElement;
    return `${el?.tagName}${el?.getAttribute('aria-pressed') ? '[pressed]' : ''}`;
  }));
}
console.log('\n  tab order (12):', order.join(' → '));

/* ---------- a question is asked once ----------
   The <h1> names the screen. Until now a single-line field also rendered a <label> with the same
   words and the same icon, so "ስምዎን ይጻፉ" appeared twice and a screen reader read it twice. axe
   cannot see this — both copies are valid labels — so it is checked here: the heading text may not
   reappear in the field area, and every field must still be named by the heading. */
for (const route of ['job', 'onboard']) {
  await page.goto(`${URL.replace(/\/$/, '')}/${route}`, { waitUntil: 'networkidle' });
  // Both forms now open with the language question, then the accessibility preferences; step
  // forward (answering the required options) until a single-line field is on screen.
  for (let i = 0; i < 5 && !(await page.locator('.op-input').count()); i++) {
    await page.locator('.op-option input').first().check({ timeout: 1000 }).catch(() => {});
    await page.getByRole('button', { name: /ቀጣይ|Next/ }).click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  const heading = (await h1()).replace(/\s+/g, ' ').trim();
  const fieldArea = (await page.locator('.op-field').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const named = await page.locator('.op-input').first().evaluate((el) => {
    const id = el.getAttribute('aria-labelledby');
    return id ? document.getElementById(id)?.textContent?.trim() ?? '' : (el.labels?.[0]?.textContent?.trim() ?? '');
  }).catch(() => '');
  if (!heading || fieldArea.includes(heading)) { failures++; console.log(`✗ ${route}: the question is printed twice (${heading})`); }
  else console.log(`✓ ${route}: the question appears once, as the heading`);
  if (!named || named !== heading) { failures++; console.log(`✗ ${route}: the field is not named by the heading → "${named}"`); }
  else console.log(`✓ ${route}: the field's accessible name is that heading`);
}

await browser.close();
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${results.length} axe audits, ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
