/**
 * Simple-words mode: does turning it on actually produce something a person can read?
 *
 * It exists because "the schema has simple strings" is not the same as "the simple strings are
 * an improvement". The first run of this test found three different questions collapsing to the
 * same one-word heading, and one screen losing its heading entirely.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const STRICT = process.argv.includes('--strict');   // content debt becomes a failure once fixed
const PORT = 8086;
const SITE = `http://127.0.0.1:${PORT}`;
const FORMS = ['onboard', 'job', 'employer'];
let fail = 0;
const ok = (c, label, extra = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

const site = spawn('node', ['tests/nginx-sim.mjs', String(PORT)], { env: { ...process.env, API_PORT: '8080' }, stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { if ((await fetch(`${SITE}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
let collisions = 0;
let singleWords = 0;

for (const slug of FORMS) {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/${slug}`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });

  // turn simple words on from the top bar, the way a person would
  await page.getByRole('button', { name: /ቀላል ቃላት|Simple words/ }).first().click();
  await page.waitForTimeout(200);

  const seen = [];
  for (let i = 0; i < 14; i++) {
    const info = await page.evaluate(() => ({
      h1: (document.querySelector('h1')?.textContent || '').trim(),
      finished: /ተጠናቅቋል|complete/.test(document.querySelector('h1')?.textContent || ''),
    }));
    if (info.finished || !info.h1 && i > 0) { if (!info.h1) seen.push({ h1: '', blank: true }); break; }
    seen.push(info);
    await page.evaluate(() => {
      const root = document.querySelector('.op-root');
      const setNative = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      for (const el of root.querySelectorAll('input, textarea')) {
        if (el.type === 'file') continue;
        if (el.type === 'radio') { if (!root.querySelector('input[type=radio]:checked')) el.click(); continue; }
        if (el.type === 'checkbox') { el.click(); continue; }
        if (el.value) continue;
        setNative(el, el.type === 'tel' ? '0912345678' : el.type === 'email' ? 'sara@example.com'
          : el.type === 'number' ? '3' : 'ሳራ በቀለ');
      }
    });
    await page.waitForTimeout(120);
    try { await page.getByRole('button', { name: /ቀጣይ|Next|ምዝገባውን ጨርስ|Finish/ }).click({ timeout: 2000 }); } catch { break; }
    await page.waitForTimeout(180);
  }

  console.log(`\n=== ${slug}: ${seen.length} screens in simple mode ===`);
  seen.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.blank ? '(BLANK HEADING)' : s.h1}`));

  const blanks = seen.filter((s) => !s.h1).length;
  ok(blanks === 0, `${slug}: no screen loses its heading in simple mode`, blanks ? `${blanks} blank` : 'none');

  const texts = seen.map((s) => s.h1).filter(Boolean);
  const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
  collisions += dupes.length;
  ok(dupes.length === 0, `${slug}: two different questions never share one simple heading`, [...new Set(dupes)].join(' | ') || 'all distinct');

  // A single word is not a question. "ስም" (name) leaves a person to infer "type your name" from a
  // page whose only heading is a noun. Length is a ceiling, never the target.
  const single = seen.filter((s) => s.h1 && s.h1.trim().split(/\s+/).length < 2);
  const singleList = single.map((s) => s.h1).join(', ');
  if (STRICT) {
    ok(single.length === 0, `${slug}: every simple heading is a phrase, not a noun`, singleList || 'none');
  } else {
    singleWords += single.length;
    console.log(`  ⚠ ${single.length} single-word heading(s)${singleList ? ': ' + singleList : ''}`);
  }

  await page.close();
}

await browser.close();
site.kill('SIGKILL');
if (!STRICT && singleWords) {
  console.log(`\n  ${singleWords} simple heading(s) are a single noun — content debt, tracked in`);
  console.log('  docs/low-literacy-copy-spec.md. Run with --strict to make it a failure.');
}
console.log(fail ? `\nFAIL — ${fail} problem(s)` : `\nPASS — 0 problem(s)${STRICT ? '' : ' (rendering)'}`);
process.exit(fail ? 1 : 0);
