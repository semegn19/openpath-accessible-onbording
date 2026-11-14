import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { answer, goto, next } from './_flow.mjs';

const browser = await chromium.launch();
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`✓ ${label}`); };
const base = process.env.ORIGIN || 'http://127.0.0.1:5173';
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      constructor() { window.recognition = this; }
      start() {}
      abort() {}
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    speechSynthesis.cancel = () => {};
    speechSynthesis.speak = utterance => { utterance.onstart?.(); queueMicrotask(() => utterance.onend?.()); };
  });
  await goto(page, base + '/onboard');
  const panel = page.locator('.roha-aside');
  const command = panel.getByRole('textbox');
  const pending = panel.locator('[data-roha-pending]');
  const confirm = panel.locator('[data-roha-confirm]');
  const send = async value => { await command.fill(value); await command.press('Enter'); };
  const say = async text => {
    await page.waitForFunction(() => window.Roha.voice.getState() === 'listening');
    await page.evaluate(text => { const result = [{ transcript: text }]; result.isFinal = true; window.recognition.onresult({ resultIndex: 0, results: [result] }); }, text);
  };
  check(await panel.isVisible() && await page.locator('dialog').count() === 0, 'assistance is visible without opening a modal');
  check(await page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect(), panel = document.querySelector('.roha-aside').getBoundingClientRect();
    return main.right <= panel.left;
  }), 'desktop panel sits beside the form without covering it');
  await page.getByRole('radio', { name: 'English', exact: true }).check(); await next(page);
  await next(page);
  await page.getByRole('radio', { name: /No, I will fill it myself/ }).check(); await next(page);
  await panel.locator('[data-roha-guide]').click();
  await send('Sara Bekele');
  check(await pending.isVisible() && await page.locator('main input[type=text]').inputValue() === '', 'answer preview does not change the form before approval');
  check((await new AxeBuilder({ page }).include('.roha-aside').analyze()).violations.length === 0, 'pending approval is accessible to axe');
  await panel.locator('[data-roha-cancel]').click();
  check(await page.locator('main input[type=text]').inputValue() === '' && await pending.isHidden(), 'cancel leaves the answer untouched');
  await send('my name is Sara Tadesse'); await confirm.click();
  check(await page.locator('main input[type=text]').inputValue() === 'Sara Tadesse', 'confirm writes the dictated name to the real input');
  await panel.locator('[data-roha-forward]').click();
  await page.locator('main input[type=tel]').waitFor();
  await panel.locator('[data-roha-back]').click();
  check(await page.locator('main input[type=text]').inputValue() === 'Sara Tadesse', 'answer survives React navigation and is stored in form state');
  await panel.locator('[data-roha-guide]').click(); await send('A stale answer');
  await page.locator('main input[type=text]').fill('Manual correction'); await send('confirm');
  check(await page.locator('main input[type=text]').inputValue() === 'Manual correction', 'approval cannot overwrite an answer edited after the preview');
  await panel.locator('[data-roha-guide]').click(); await send('Another answer');
  await next(page); await send('confirm');
  check(await page.locator('main input[type=tel]').inputValue() === '', 'approval from a previous question cannot fill the new question');
  await panel.locator('[data-roha-guide]').click();
  await panel.locator('[data-roha-control="roha-launcher-pill"]').click();
  await say('0912345678');
  check(await pending.isVisible() && await page.locator('main input[type=tel]').inputValue() === '', 'spoken phone answer waits for separate approval');
  await say('confirm');
  check(await page.locator('main input[type=tel]').inputValue() === '0912345678', 'spoken confirmation applies the phone number');
  await say('next step');
  await page.waitForFunction(() => document.querySelector('main').dataset.stepType === 'radio');
  await say('I do not have any of these');
  // Choice text must match the actual option (or use its displayed number).
  if (await pending.isHidden()) await say('5');
  check(await pending.isVisible(), 'guided filling follows the new question and accepts a choice');
  await say('cancel');
  check(await pending.isHidden(), 'spoken cancellation clears a choice proposal');
  await panel.locator('[data-roha-control="roha-btn-stop"]').click();
  await page.screenshot({ path: '/tmp/roha-inline-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  await send('zoom in'); await send('zoom in');
  await page.screenshot({ path: '/tmp/roha-inline-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) console.log(await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *')).filter(el => el.getBoundingClientRect().right > innerWidth + 1)
      .map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })).slice(0, 20)));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '320px layout at 200% text has no horizontal page overflow');
  check(await panel.evaluate(el => el.getBoundingClientRect().top >= document.querySelector('main').getBoundingClientRect().bottom), 'small-screen assistant follows the form without obscuring it');
  await page.screenshot({ path: '/tmp/roha-inline-mobile.png', fullPage: true });

  // Walk a real form to its final step. Only the delivery transport is mocked.
  await page.setViewportSize({ width: 1280, height: 900 });
  await goto(page, base + '/onboard');
  let deliveries = 0;
  await page.route('**/api/submissions', route => { deliveries++; return route.fulfill({ status: 503, json: { error: 'test-offline' } }); });
  await answer(page, { lang: 'en', name: 'Approved Learner' });
  await send('next step');
  await page.waitForFunction(() => document.querySelector('main').dataset.stepType === 'submit');
  check(!await page.locator('main input[type=checkbox]').first().isChecked(), 'Roha never preselects sharing consent');
  await panel.locator('[data-roha-guide]').click(); await send('yes');
  check(await pending.isVisible() && !await page.locator('main input[type=checkbox]').first().isChecked(), 'consent itself is previewed before it changes');
  await send('confirm');
  check(await page.locator('main input[type=checkbox]').first().isChecked(), 'explicit approval selects the consent checkbox');
  await send('next step');
  check(await pending.isVisible() && deliveries === 0, 'final send requires a separate approval after consent');
  await send('cancel');
  check(deliveries === 0 && await pending.isHidden(), 'cancelling final send makes no delivery request');
  await send('next step'); await send('confirm');
  await page.waitForFunction(() => !!document.querySelector('.op-receipt'));
  check(deliveries === 1, 'one confirmed final action makes one delivery attempt');
  check(!/sub-local-|sub-native-/.test(await page.locator('body').innerText()), 'assistant never invents a delivery receipt');
  await page.close();

  const embedded = await context.newPage();
  await embedded.setContent('<html lang="en"><body><h1>Contact</h1><form><label for="name">Name</label><input id="name"><label for="city">City</label><select id="city"><option value="">Choose</option><option value="addis">Addis Ababa</option><option value="adama">Adama</option></select><label for="secret">Password</label><input type="password" id="secret"><button type="submit">Send application</button></form></body></html>');
  await embedded.addScriptTag({ content: await readFile(new URL('../dist/roha.js', import.meta.url), 'utf8') });
  await embedded.evaluate(() => {
    window.Roha.mount({ root: document.body, language: 'en' });
    window.sent = 0;
    document.querySelector('form').onsubmit = event => { event.preventDefault(); window.sent++; };
    window.propose = (name, value) => {
      const map = window.Roha.rescan(), target = map.resources.find(r => r.name === name);
      return window.Roha.executeIntent({ schemaVersion: '2.0', utteranceId: 'embed-test', mapId: map.mapId, mapVersion: map.mapVersion, intent: 'propose_answer', targetId: target.id, payload: { value } });
    };
    window.propose('Name', '<b>literal name</b>');
  });
  await embedded.locator('[data-roha-confirm]').click();
  check(await embedded.locator('#name').inputValue() === '<b>literal name</b>' && await embedded.locator('.roha-aside b').count() === 0, 'body-root plugin confirms literal answer text without treating it as HTML');
  await embedded.evaluate(() => {
    window.propose('Name', 'New proposal');
    document.querySelector('[data-roha-confirm]').focus();
    document.querySelector('#name').value = 'External correction';
    window.Roha.rescan();
  });
  check(await embedded.locator('[data-roha-pending]').isHidden() && await embedded.locator('[data-roha-control="roha-command"]').evaluate(el => el === document.activeElement), 'invalidating a focused approval restores focus to the command input');
  const ambiguous = await embedded.evaluate(() => window.propose('City', 'Ad'));
  check(!ambiguous.success && await embedded.locator('#city').inputValue() === '', 'ambiguous select text does not choose the placeholder or an arbitrary option');
  await embedded.evaluate(() => window.propose('City', 'Addis Ababa'));
  await embedded.locator('[data-roha-confirm]').click();
  check(await embedded.locator('#city').inputValue() === 'addis', 'confirmed exact select label applies the correct option value');
  const secret = await embedded.evaluate(() => window.propose('Password', 'private'));
  check(!secret.success && await embedded.locator('#secret').inputValue() === '', 'password filling is unavailable');
  await embedded.locator('[data-roha-forward]').click();
  check(await embedded.evaluate(() => window.sent) === 0, 'generic host submit always waits for approval');
  await embedded.locator('[data-roha-confirm]').click();
  await embedded.evaluate(() => window.Roha.handleUserUtterance('confirm'));
  check(await embedded.evaluate(() => window.sent) === 1, 'duplicate confirmation cannot repeat a generic submission');
  await embedded.evaluate(() => window.Roha.mount({ root: document.body, language: 'en', overrides: [
    { targetSelector: 'input, select', allowedIntents: ['read'] }, { targetSelector: 'form', allowedIntents: ['review'] },
  ] }));
  await embedded.locator('[data-roha-guide]').click();
  await embedded.evaluate(() => window.Roha.handleUserUtterance('New name'));
  check(await embedded.locator('[data-roha-pending]').isHidden() && await embedded.locator('#name').inputValue() === 'External correction', 'guided filling respects host-declared read-only fields');
  await embedded.locator('[data-roha-forward]').click();
  check(await embedded.locator('[data-roha-pending]').isHidden() && await embedded.evaluate(() => window.sent) === 1, 'guided submission respects host-declared allowed actions');
  await embedded.close();
} finally { await browser.close(); }
console.log(`${checks}/${checks} guided form checks passed (speech and delivery transport mocked)`);
