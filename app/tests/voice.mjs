// Voice input that actually produces a usable phone number, and the "new question" announcement.
import { chromium } from 'playwright';
import { answer, goto, next, submitFromReview } from './_flow.mjs';

const BASE = process.env.URL || 'http://127.0.0.1:5173/';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
let fail = 0;
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

// Stub the Web Speech API: an Amharic speaker reads the number digit by digit.
await p.addInitScript(() => {
  class FakeRec {
    lang = ''; interimResults = false; maxAlternatives = 1;
    onresult = null; onerror = null; onend = null;
    start() { setTimeout(() => {
      this.onresult?.({ results: [[{ transcript: 'ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት' }]] });
      this.onend?.();
    }, 40); }
    stop() {}
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
});

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

await goto(p, BASE);
const live = p.locator('[role="status"][aria-live="polite"]').first();

// language → accessibility preferences → assistance → name, then speak the phone number
await p.getByRole('radio', { name: /አማርኛ/ }).check();
await next(p); await p.waitForTimeout(150);
await next(p); await p.waitForTimeout(150);                       // prefs: none
await p.getByRole('radio', { name: /አይ፣ ራሴ|No, I will fill/ }).check();
await next(p); await p.waitForTimeout(150);
await p.locator('input[type="text"]').first().fill('ሳራ ተስፋዬ');
await next(p); await p.waitForTimeout(200);

// now on phone: speak it
ok(await p.locator('input[type="tel"]').isVisible(), 'phone step reached');
await p.getByRole('button', { name: /በድምጽ መልስ/ }).click();
await p.waitForTimeout(300);
await p.locator('.op-voice-card').screenshot({ path: 'screenshots/3-voice.png' });
const card = (await p.locator('.op-voice-card').innerText()).replace(/\s+/g, ' ').trim();
ok(card.includes('ዘጠኝ'), 'review card shows what was heard', card);
ok(card.includes('911234567'), 'review card shows the digits it will use');
await p.getByRole('button', { name: 'ትክክል ነው' }).click();
await p.waitForTimeout(200);
const typed = await p.locator('input[type="tel"]').inputValue();
ok(typed === '911234567', 'accepting fills the field with digits', typed);

await next(p); await p.waitForTimeout(300);
const h1 = (await p.locator('h1').first().innerText()).trim();
ok(!/ስልክ/.test(h1), 'valid phone number passes validation', `now: ${h1}`);

// conditional reveal: choosing "refer me" adds a question → announce the new total
await p.getByRole('radio', { name: /ምንም መታወቂያ|do not have any/ }).check();
await p.waitForTimeout(300);
const said = await live.innerText();
const progress = await p.locator('.op-progress').innerText();
ok(/አዲስ ጥያቄ|new question/.test(said), 'new question is announced', said);
// the total must match what was announced, whatever the schema's step count is
const announcedTotal = said.match(/ከ (\d+)|of (\d+)/)?.slice(1).find(Boolean);
const shownTotal = progress.match(/ከ (\d+)|of (\d+)/)?.slice(1).find(Boolean);
ok(announcedTotal && shownTotal === announcedTotal, 'progress matches the announced total', `${progress.replace(/\s+/g, ' ')} (announced ${announcedTotal})`);

await b.close();
console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
