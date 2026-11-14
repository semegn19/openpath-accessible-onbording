/**
 * Controls audit: is there actually a read-aloud on every screen, and a microphone on every
 * screen that takes an answer?
 *
 * This test exists because "it is in the schema" was mistaken for "it is on the screen" — by
 * me, in a status report, on 13 Nov. The language question turned out to be the one screen in
 * the whole product with no way to hear the question, and it is the FIRST one a learner meets.
 * A rule that is only in the schema is a rule nobody has checked.
 *
 * It walks all three forms to the end, which the other suites never did.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8088;
const SITE = `http://127.0.0.1:${PORT}`;
const FORMS = [
  { slug: 'onboard', label: 'learner sign-up' },
  { slug: 'job', label: 'job / career' },
  { slug: 'employer', label: 'employer accommodations' },
];

const site = spawn('node', ['tests/nginx-sim.mjs', String(PORT)], { env: { ...process.env, API_PORT: '8080' }, stdio: 'ignore' });
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`${SITE}/`)).ok) break; } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 100));
}

let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });

for (const form of FORMS) {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/${form.slug}`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });

  const seen = [];
  for (let step = 0; step < 14; step++) {
    const info = await page.evaluate(() => {
      const root = document.querySelector('.op-root');
      const btns = [...(root?.querySelectorAll('button') ?? [])];
      return {
        h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 30),
        readAloud: btns.filter((b) => /ያዳምጡ|አንብብልኝ|Read the question|እነዚህን መልሶች|Listen to your answers/.test(b.textContent || '')).length,
        mic: btns.filter((b) => /በድምጽ|Speak your answer/.test(b.textContent || '')).length,
        consent: Boolean(root?.querySelector('.op-consent, [data-consent]'))
          || /ማረጋገጫ|Confirmation/.test(document.querySelector('h1')?.textContent || ''),
        stepType: root?.getAttribute('data-step-type') ?? '',
        isReview: Boolean(root?.querySelector('.op-review')),
        finished: document.body.textContent?.includes('ምዝገባው ተጠናቅቋል') || document.body.textContent?.includes('Sign-up complete'),
        type: root?.querySelector('input[type=radio]') ? 'radio'
          : root?.querySelector('input[type=checkbox]') ? 'checkbox'
          : root?.querySelector('select') ? 'select'
          : root?.querySelector('input, textarea') ? 'text' : 'none',
      };
    });
    if (info.finished) break;
    seen.push(info);

    // fill this step the way a person would, then advance
    await page.evaluate(() => {
      const root = document.querySelector('.op-root');
      const setNative = (el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      for (const el of root.querySelectorAll('input, textarea')) {
        if (el.type === 'radio') { if (!root.querySelector('input[type=radio]:checked')) el.click(); continue; }
        if (el.type === 'checkbox') { if (!el.checked && root.querySelectorAll('input[type=checkbox]').length === 1) el.click(); continue; }
        if (el.value) continue;
        if (el.type === 'tel') setNative(el, '0912345678');
        else if (el.type === 'email') setNative(el, 'sara@example.com');
        else if (el.type === 'number') setNative(el, '3');
        else if (el.tagName === 'TEXTAREA') setNative(el, 'በሽያጭ ውስጥ ልምድ አለኝ።');
        else setNative(el, 'ሳራ በቀለ');
      }
      const sel = root.querySelector('select');
      if (sel && !sel.value) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(120);
    const nextBtn = page.getByRole('button', { name: /ቀጣይ|Next|ምዝገባውን ጨርስ|Finish/ });
    try { await nextBtn.click({ timeout: 2500 }); } catch { break; }
    await page.waitForTimeout(200);
    // a validation error means the filler missed something — record it rather than loop forever
    const err = await page.locator('.op-error').count()
      ? await page.locator('.op-error').first().innerText({ timeout: 500 }).catch(() => '') : '';
    if (err) { console.log(`  ! stuck: ${err.slice(0, 40)}`); break; }
  }

  console.log(`\n=== ${form.slug} — ${seen.length} screens walked ===`);
  seen.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.h1.padEnd(32)} readAloud:${s.readAloud} mic:${s.mic}${s.consent ? ' [consent]' : ''}`));

  ok(seen.length >= (form.slug === 'employer' ? 6 : 8), `${form.label}: the walk reaches the end`, `${seen.length} screens`);

  const noReadAloud = seen.map((s, i) => (!s.readAloud ? `${i + 1} (${s.h1})` : null)).filter(Boolean);
  ok(noReadAloud.length === 0, `${form.label}: every screen can read itself aloud`, noReadAloud.join(', ') || 'all screens');

  // A microphone is expected wherever a person has to *produce* something to say: free text,
  // a number, a long choice list. It is deliberately absent on (a) consent screens — a dictated
  // consent is not consent — and (b) the language question, whose two answers are the names of
  // two languages, rendered in both scripts, in the one screen where we cannot yet know which
  // language they read. Those two exceptions are the rule, not an oversight.
  // A microphone is expected wherever a person produces an answer. It is absent only on consent
  // screens — a dictated consent is not consent. The language question now has one too.
  const NO_MIC_BY_DESIGN = ['statement', 'submit', 'file'];
  const answering = seen
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.isReview && !s.finished && !NO_MIC_BY_DESIGN.includes(s.stepType));
  const noMic = answering.filter(({ s }) => s.mic === 0).map(({ s, i }) => `${i + 1} (${s.h1})`);
  ok(noMic.length === 0, `${form.label}: every answering screen offers a microphone`, noMic.join(', ') || `${answering.length} screens`);

  const micOnConsent = seen.filter((s) => s.consent && s.mic > 0).length;
  ok(micOnConsent === 0, `${form.label}: no microphone on a consent screen`, micOnConsent ? `${micOnConsent} found` : 'none');

  await page.close();
}

/* ---------- the two setup screens must SHOW what is applied ----------
   A checkbox that stays blank while the setting is on is worse than no checkbox: it tells the
   person the opposite of the truth about the page they are looking at. */
for (const slug of ['onboard', 'job']) {
  const page = await ctx.newPage();
  await page.goto(`${SITE}/${slug}`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });

  const outcome = async () => page.evaluate(() => {
    const root = document.querySelector('.op-root');
    const checked = [...root.querySelectorAll('.op-option input:checked')]
      .map((el) => el.closest('.op-option')?.textContent?.trim() ?? '');
    const chips = [...document.querySelectorAll('.op-settingsbar button')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.textContent.trim());
    return { heading: document.querySelector('h1')?.textContent?.trim() ?? '', checked, chips };
  });

  const first = await outcome();
  ok(first.checked.length === 1, `${slug}: the language screen shows the language in use`,
     first.checked[0] ?? 'nothing checked');
  ok(first.chips.some((c) => /አማርኛ|English/.test(c)), `${slug}: and the bar agrees with it`, first.chips.join(', '));

  // change the language from the bar — the radio must follow
  // the Amharic chip's label is "አማርኛ" and the English one's is "English" — match only the latter
  await page.locator('.op-settingsbar button').filter({ hasText: /^\s*English\s*$/ }).first().click();
  await page.waitForTimeout(250);
  const second = await outcome();
  ok(second.checked[0] !== first.checked[0], `${slug}: changing language from the bar moves the check`,
     `${first.checked[0]} → ${second.checked[0]}`);

  // forward to the preferences screen: nothing applied, so nothing ticked
  await page.getByRole('button', { name: /ቀጣይ|Next/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const prefsBefore = await outcome();
  ok(prefsBefore.checked.length === 0, `${slug}: preferences start unticked when nothing is on`,
     prefsBefore.checked.join(', ') || 'none ticked');

  // apply one from the bar — the box must tick itself
  await page.locator('.op-settingsbar button').filter({ hasText: /ቀላል ቃላት|Simple words/ }).first().click();
  await page.waitForTimeout(300);
  const prefsAfter = await outcome();
  ok(prefsAfter.checked.some((c) => /ቀላል ቃላት|Simple words/.test(c)),
     `${slug}: turning a support on at the top ticks its box`, prefsAfter.checked.join(', ') || 'nothing ticked');

  // and un-ticking the box turns it off again
  const box = page.locator('.op-option input').nth(2);
  await box.uncheck({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
  const prefsOff = await outcome();
  ok(!prefsOff.chips.some((c) => /ቀላል ቃላት|Simple words/.test(c)),
     `${slug}: un-ticking the box turns the setting off again`, prefsOff.chips.join(', ') || 'no chips pressed');
  await page.close();
}

await browser.close();
site.kill('SIGKILL');
console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
