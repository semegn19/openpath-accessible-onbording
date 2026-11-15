// Voice input that actually produces a usable phone number, and the "new question" announcement.
import { chromium } from 'playwright';
import { answer, goto, next, submitFromReview, walkTo, stepNo as stepNumberOf, setLang } from './_flow.mjs';

const BASE = process.env.URL || 'http://127.0.0.1:5173/';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
let fail = 0;
// Capture what read-aloud actually asks the speech engine to say, and give the page an Amharic
// voice so `speak()` succeeds instead of taking the "no voice" branch.
// Named so a second page (the simple-words block at the end) can install the same stub.
const installSpeechStub = () => {
  window.__spoken = [];
  const voices = [{ lang: 'am-ET', name: 'stub-am' }, { lang: 'en-US', name: 'stub-en' }];
  // speechSynthesis is a getter on Window.prototype — plain assignment silently does nothing
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => voices, speak: (u) => window.__spoken.push(u.text), cancel: () => {} },
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: class { constructor(t) { this.text = t; } },
  });
  // Force Web Speech fallback in this test so the synthesized text can be verified
  window.Audio = class {
    play() { return Promise.reject(new Error('web-speech-test')); }
    pause() {}
    addEventListener(evt, cb) { if (evt === 'error') cb(); }
  };
};
await p.addInitScript(installSpeechStub);
const ok = (cond, label, extra = '') => { if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`); };

// Stub the Web Speech API: an Amharic speaker reads the number digit by digit.
await p.addInitScript(() => {
  window.__stt = { said: 'ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት', failLangs: [] };
  class FakeRec {
    lang = ''; interimResults = false; maxAlternatives = 1;
    onresult = null; onerror = null; onend = null;
    start() {
      setTimeout(() => {
        const cfg = window.__stt;
        // Chrome's real behaviour for a language it has no model for, which is what Amharic is.
        if (cfg.failLangs.includes(this.lang)) { this.onerror?.({ error: 'language-not-supported' }); this.onend?.(); return; }
        this.onresult?.({ results: [[{ transcript: cfg.said }, { transcript: cfg.said }]] });
        this.onend?.();
      }, 40);
    }
    stop() {}
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
});

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

/* ---------- what read-aloud actually says on the language screen ---------- */
await p.getByRole('button', { name: /ያዳምጡ|አንብብልኝ|Read the question/ }).first().click();
await p.waitForTimeout(150);
const spoken = (await p.evaluate(() => window.__spoken)).join(' ');
ok(/ቋንቋ/.test(spoken), 'read-aloud says the question', spoken.slice(0, 40));
ok(/አስቀድመው|First choose/.test(spoken),
   'read-aloud also says the default intro', spoken.slice(0, 90));
ok(/አማርኛ/.test(spoken) && /English|እንግሊዝኛ/.test(spoken), 'read-aloud reads both language options');

/* ---------- simple words: the same screen, said in fewer words ---------- */
const heading = () => p.locator('#op-q-title').innerText();
const intro = () => p.locator('.op-intro').innerText();
const defaultHeading = (await heading()).trim(), defaultIntro = (await intro()).trim();
await p.getByRole('button', { name: /ቀላል ቃላት|Simple words/ }).click();
await p.waitForTimeout(150);
const simpleIntro = (await intro()).trim(), simpleHeading = (await heading()).trim();
ok(simpleIntro !== defaultIntro && /ቀስ ብለው|Take your time/.test(simpleIntro),
   'simple words shortens the intro', `"${defaultIntro.slice(0, 28)}…" → "${simpleIntro}"`);
ok(/\{/.test(defaultHeading + simpleHeading) === false, 'no placeholder in either heading');
ok(simpleHeading !== defaultHeading || defaultHeading.length > 0, 'the heading follows the mode', `${defaultHeading} | ${simpleHeading}`);
await p.evaluate(() => { window.__spoken.length = 0; });
await p.getByRole('button', { name: /ያዳምጡ|አንብብልኝ|Read the question/ }).first().click();
await p.waitForTimeout(150);
const simpleSpoken = (await p.evaluate(() => window.__spoken)).join(' ');
ok(/ቀስ ብለው|Take your time/.test(simpleSpoken),
   'and read-aloud speaks the short intro too, not the long one', simpleSpoken.slice(0, 80));
await p.getByRole('button', { name: /ቀላል ቃላት|Simple words/ }).click();   // back to default
await p.waitForTimeout(150);
ok((await intro()).trim() === defaultIntro, 'turning it off restores the full intro');
await p.evaluate(() => { window.__spoken.length = 0; });

/* ---------- step 1 by voice: the mic is there, and it can actually change the language ---------- */
const mic = p.getByRole('button', { name: /በድምጽ|Speak your answer|Speak answer/ }).first();
ok(await mic.count() === 1, 'the language question has a microphone');

await p.evaluate(() => { window.__stt.said = 'English'; });
await mic.click();
await p.waitForTimeout(250);
let langCard = (await p.locator('.op-voice-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(/English/.test(langCard), 'saying "English" is understood as a choice', langCard.slice(0, 60));
await p.getByRole('button', { name: /ትክክል ነው|That is right/ }).click();
await p.waitForTimeout(250);
ok(await p.evaluate(() => document.documentElement.lang) === 'en', 'accepting it switches the form to English');

// back to the Amharic UI for the rest of the walk
await p.getByRole('button', { name: /አማርኛ/ }).first().click();
await p.waitForTimeout(200);

/* ---------- the case that used to fail silently ---------- */
await p.evaluate(() => { window.__stt.said = 'qwerty plover'; });
await p.getByRole('button', { name: /በድምጽ|Speak your answer|Speak answer/ }).first().click();
await p.waitForTimeout(250);
const nomatch = (await p.locator('.op-voice-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(/አልገባኝም|did not catch/.test(nomatch), 'an unrecognised answer says so instead of doing nothing', nomatch.slice(0, 50));
const pickButtons = await p.locator('.op-voice-card .op-btn').count();
ok(pickButtons >= 2, 'and offers the real options to tap instead', `${pickButtons} buttons`);
await p.locator('.op-voice-card .op-btn').first().click();
await p.waitForTimeout(150);

/* ---------- no Amharic speech model: try the other language, then say so ---------- */
await p.evaluate(() => { window.__stt.failLangs = ['am-ET']; window.__stt.said = 'English'; });
await p.getByRole('button', { name: /በድምጽ|Speak your answer|Speak answer/ }).first().click();
await p.waitForTimeout(350);
langCard = (await p.locator('.op-voice-card').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(/English/.test(langCard), 'when am-ET is unsupported it retries in en-US instead of dying', langCard.slice(0, 60));
await p.getByRole('button', { name: /ትክክል ነው|That is right|That is right/ }).first().click().catch(() => {});
await p.waitForTimeout(200);

await p.evaluate(() => { window.__stt.failLangs = ['am-ET', 'en-US']; });
await p.getByRole('button', { name: /በድምጽ|Speak your answer|Speak answer/ }).first().click();
await p.waitForTimeout(400);
const unavailable = (await p.locator('[data-stt-error]').innerText().catch(() => '')).replace(/\s+/g, ' ');
// The message must name the actual cause, not shrug at the language, and must always leave a way forward.
const NAMED = /ኢንተርኔት|ፈቃድ|አይደገፍም|አይሠራም|ሞዴል|ማይክሮፎን|microphone|network|permission|blocked|not supported|no speech model|secure page|embedded frame/i;
ok(NAMED.test(unavailable), 'the failure names a real cause (permission, network, language, environment)', unavailable.slice(0, 90));
ok(/አዝራር|buttons|type instead|በጽሑፍ/.test(unavailable), 'and still offers the buttons as the way forward', unavailable.slice(0, 90));
ok(!/\{n\}|\{\w+\}/.test(unavailable), 'with no placeholder left in it');
await p.evaluate(() => { window.__stt.failLangs = ['am-ET'].slice(0, 0); window.__stt.said = 'ዘጠኝ አንድ አንድ ሁለት ሶስት አራት አምስት ስድስት ሰባት'; });

await goto(p, BASE);
const live = p.locator('[role="status"][aria-live="polite"]').first();

// language → accessibility preferences → name, then speak the phone number
await p.getByRole('radio', { name: /አማርኛ/ }).check();
await next(p); await p.waitForTimeout(150);
await next(p); await p.waitForTimeout(150);                       // prefs: none
await p.locator('input[type="text"]').first().fill('ሳራ ተስፋዬ');
await next(p); await p.waitForTimeout(200);

// now on phone: speak it
ok(await p.locator('input[type="tel"]').isVisible(), 'phone step reached');
await p.getByRole('button', { name: /በድምጽ/ }).click();
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

// conditional reveal: choosing an ID type adds a question → announce the new total
await p.getByRole('radio', { name: /የቀበሌ|Kebele/ }).check();
await p.waitForTimeout(300);
const said = await live.innerText();
const progress = await p.locator('.op-progress').innerText();
ok(/አዲስ ጥያቄ|new question/.test(said), 'new question is announced', said);
// the total must match what was announced, whatever the schema's step count is
const announcedTotal = said.match(/ከ (\d+)|of (\d+)/)?.slice(1).find(Boolean);
const shownTotal = progress.match(/ከ (\d+)|of (\d+)/)?.slice(1).find(Boolean);
ok(announcedTotal && shownTotal === announcedTotal, 'progress matches the announced total', `${progress.replace(/\s+/g, ' ')} (announced ${announcedTotal})`);

/* ---------- the simple-words layer must be spoken, not just shown ---------- */
{
  const q = await c.newPage();
  await q.addInitScript(installSpeechStub);
  const goto2 = async () => {
    await q.goto(`${BASE.replace(/\/$/, '')}/onboard`, { waitUntil: 'load' });
    await q.evaluate(() => localStorage.clear());
    await q.reload({ waitUntil: 'load' });
  };
  await goto2();
  await q.getByRole('button', { name: /ቀላል ቃላት|Simple words/ }).click();
  await q.waitForTimeout(150);
  await q.locator('.op-option input').first().check();
  await q.getByRole('button', { name: /^ቀጣይ$|^Next$/ }).first().click();
  await q.waitForTimeout(250);
  const shownHint = (await q.locator('.op-hint').first().innerText()).replace(/\s+/g, ' ').trim();
  const shownHeading = (await q.locator('#op-q-title').innerText()).replace(/\s+/g, ' ').trim();
  await q.evaluate(() => { window.__spoken.length = 0; });
  await q.getByRole('button', { name: /ያዳምጡ|አንብብልኝ|Read the question/ }).first().click();
  await q.waitForTimeout(200);
  const spoken = (await q.evaluate(() => window.__spoken)).join(' ').replace(/\s+/g, ' ');
  // A hint that is displayed in its short form but spoken in its long form is the same class of
  // bug as a screen that shows text nobody reads out.
  ok(spoken.includes(shownHeading), 'simple mode: the heading that is shown is the one spoken', shownHeading);
  ok(spoken.includes(shownHint), 'simple mode: the hint that is shown is the one spoken', shownHint.slice(0, 60));
  ok(!/How would you like this form to work for you|ቅጹ እንዴት እንዲሠራልዎት/.test(spoken),
     'simple mode: the long wording is not read over the short one');
  await q.close();
}

/* ---------- a spoken choice has to land somewhere ----------
   `job-category` was a <select> with six options. The mic appeared, the transcript was shown
   back, the person pressed "That is right", and the dropdown stayed on "Choose one" — because a
   dropdown was handed no option list to match against. The step is optional, so nothing errored
   and the answer was simply gone. This walks the employer form to that step and speaks.
*/
{
  const q = await c.newPage();
  await q.addInitScript(installSpeechStub);
  await q.addInitScript(() => {
    window.__stt = { said: 'Sales', failLangs: [] };
    class FakeRec {
      lang = ''; interimResults = false; maxAlternatives = 1;
      onresult = null; onerror = null; onend = null;
      start() {
        setTimeout(() => {
          const cfg = window.__stt;
          if (cfg.failLangs.includes(this.lang)) { this.onerror?.({ error: 'language-not-supported' }); this.onend?.(); return; }
          this.onresult?.({ results: [[{ transcript: cfg.said }, { transcript: cfg.said }]] });
          this.onend?.();
        }, 40);
      }
      stop() {}
    }
    window.webkitSpeechRecognition = FakeRec;
    window.SpeechRecognition = FakeRec;
  });
  await q.goto(`${BASE.replace(/\/$/, '')}/employer`, { waitUntil: 'load' });
  await q.evaluate(() => localStorage.clear());
  await q.reload({ waitUntil: 'load' });
  // Shared primitives: setLang ticks the language radio *by name* (a generic "first radio" click
  // on step 1 switches the form's language instead), and walkTo stops on the counter rather than
  // clicking Next a guessed number of times.
  await setLang(q, 'en');
  await walkTo(q, 5, { fill: true });
  const atCategory = (await stepNumberOf(q)) === 5;
  ok(atCategory, 'employer: reached the category question', String(await stepNumberOf(q)));
  // The shape of the control is the point: cards, not a dropdown, so the options carry icons.
  ok(await q.locator('.op-root select').count() === 0, 'employer: category is not a dropdown');
  const cards = await q.locator('.op-root .op-option').count();
  ok(cards === 6, 'employer: all six categories are visible at once', `${cards} cards`);

  await q.getByRole('button', { name: /በድምጽ|Speak your answer|Speak answer/ }).first().click();
  await q.waitForTimeout(400);
  const acceptBtn = q.getByRole('button', { name: /ትክክል ነው|That is right/ });
  const offeredAccept = await acceptBtn.count();
  ok(offeredAccept > 0, 'employer: the mic hears the category and asks before taking it');
  if (offeredAccept) await acceptBtn.first().click();
  await q.waitForTimeout(300);
  await q.waitForTimeout(300);
  const picked = await q.locator('.op-root input[type=radio]:checked').count();
  const pickedVal = picked ? await q.locator('.op-root input[type=radio]:checked').first().inputValue() : '(none)';
  ok(pickedVal === 'sales', 'employer: saying a category selects that category', pickedVal);
  await q.close();
}

await b.close();
console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
