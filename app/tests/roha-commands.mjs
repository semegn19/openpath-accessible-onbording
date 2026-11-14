import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; console.log(`✓ ${label}`); };
const base = process.env.ORIGIN || 'http://127.0.0.1:5173';
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.voiceTest = { requests: 0, starts: 0, spoken: 0, stoppedTracks: 0, pending: false, denied: false, instances: [] };
    window.SpeechRecognition = class {
      constructor() { window.voiceTest.recognition = this; window.voiceTest.instances.push(this); }
      start() { window.voiceTest.starts++; if (window.voiceTest.startError) throw new Error('start failed'); }
      abort() { this.onend?.(); }
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      window.voiceTest.requests++;
      if (window.voiceTest.denied) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      if (window.voiceTest.pending) await new Promise(resolve => { window.voiceTest.grant = resolve; });
      return { getTracks: () => [{ stop() { window.voiceTest.stoppedTracks++; } }] };
    } } });
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.speak = utterance => { window.voiceTest.spoken++; window.voiceTest.utterance = utterance; utterance.onstart?.(); };
    window.say = (text, interim) => {
      const result = [{ transcript: text }]; result.isFinal = true;
      const results = [result];
      if (interim) { const next = [{ transcript: interim }]; next.isFinal = false; results.push(next); }
      window.voiceTest.recognition.onresult({ resultIndex: 0, results });
    };
  });
  await page.goto(base + '/onboard', { waitUntil: 'networkidle' });
  check(await page.evaluate(() => window.voiceTest.requests) === 0, 'loading the page does not request microphone access');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.roha-aside').lang === 'en');
  check(await page.evaluate(() => window.Roha.getMap().locale) === 'en', 'page language selection updates the assistant without manual remount');
  const fontSize = () => page.locator('h1').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  const before = await fontSize();
  const launcher = page.locator('[data-roha-control="roha-launcher-pill"]');
  await launcher.click();
  await page.waitForFunction(() => window.voiceTest.starts === 1);
  check(await page.evaluate(() => window.voiceTest.requests === 1 && window.voiceTest.recognition.lang === 'en-US' && window.voiceTest.spoken === 0), 'opening asks for the microphone and listens in English immediately without a spoken welcome');
  const reply = page.locator('[data-roha-control="roha-transcript"]');
  await page.evaluate(() => window.say('bigger test', 'reset size'));
  check(Math.abs(await fontSize() / before - 1.5) < 0.01, 'spoken bigger test increases the rendered question size by 50%');
  check(await reply.textContent() === 'Text size adjusted to 150%', 'completed voice action keeps its result instead of Working feedback');
  await page.evaluate(() => window.voiceTest.recognition.onend());
  await page.waitForFunction(() => window.voiceTest.starts === 2);
  check(await reply.textContent() === 'Text size adjusted to 150%', 'continuous recognition restart preserves the last result');
  await page.evaluate(() => window.say('zoom in'));
  check(Math.abs(await fontSize() / before - 2) < 0.01, 'spoken zoom in enlarges rendered text to 200%');
  await page.locator('[data-roha-control="roha-btn-bigger"]').click();
  check(Math.abs(await fontSize() / before - 2) < 0.01, 'Bigger text never unexpectedly shrinks text at the maximum size');
  await page.evaluate(() => { window.lateResult = window.voiceTest.recognition.onresult; });
  await page.locator('[data-roha-control="roha-btn-stop"]').click();
  await page.evaluate(() => { const r = [{transcript:'reset size'}]; r.isFinal=true; window.lateResult({resultIndex:0,results:[r]}); });
  check(Math.abs(await fontSize() / before - 2) < 0.01, 'Stop ignores delayed recognition results');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'አማርኛ', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.roha-aside').lang === 'am');
  check(Math.abs(await fontSize() / before - 2) < 0.01, 'changing language preserves text enlargement');
  await launcher.click();
  await page.waitForFunction(() => window.voiceTest.recognition?.lang === 'am-ET');
  await page.evaluate(() => window.say('reset size'));
  check(/[\u1200-\u137F]/.test(await reply.textContent()) && Math.abs(await fontSize() - before) < 0.01, 'language switching updates recognition and response text while commands still execute');
  await page.getByRole('dialog').getByRole('textbox').fill('unfinished request');
  await page.evaluate(() => { document.documentElement.lang = 'en'; });
  await page.waitForFunction(() => window.voiceTest.recognition?.lang === 'en-US' && document.querySelector('.roha-aside').lang === 'en');
  check(await page.getByRole('dialog').getByRole('textbox').inputValue() === 'unfinished request', 'language change while listening preserves an open dialog and typed draft');
  await page.evaluate(() => window.say('read page'));
  check(await page.evaluate(() => window.Roha.voice.getState()) === 'speaking', 'explicit read command pauses recognition to prevent echo');
  await page.evaluate(() => window.voiceTest.utterance.onend());
  await page.waitForFunction(() => window.Roha.voice.getState() === 'listening');
  await page.evaluate(() => window.say('bigger text'));
  check(Math.abs(await fontSize() / before - 1.5) < 0.01, 'spoken commands work again after requested speech finishes');
  await page.keyboard.press('Escape');
  // A fresh SDK simulates a first permission prompt which resolves after Stop.
  await page.evaluate(() => { window.Roha.mount({root:document.querySelector('main')}); window.voiceTest.pending = true; window.voiceTest.grant = null; });
  await launcher.click();
  await page.waitForFunction(() => !!window.voiceTest.grant);
  const starts = await page.evaluate(() => window.voiceTest.starts);
  await page.locator('[data-roha-control="roha-btn-stop"]').click();
  await page.evaluate(() => { window.voiceTest.pending = false; window.voiceTest.grant(); });
  await page.waitForTimeout(250);
  check(await page.evaluate(() => window.voiceTest.starts) === starts, 'Stop cancels activation even if microphone permission arrives later');
  check(await page.evaluate(() => window.voiceTest.stoppedTracks === window.voiceTest.requests), 'permission probe releases every microphone stream');
  await page.evaluate(() => { window.voiceTest.denied = true; });
  await page.locator('[data-roha-control="roha-btn-mic"]').click();
  await page.waitForFunction(() => document.querySelector('[data-roha-control="roha-transcript"]').textContent.includes('denied'));
  await page.getByRole('dialog').getByRole('textbox').fill('bigger text');
  await page.getByRole('dialog').getByRole('textbox').press('Enter');
  check(Math.abs(await fontSize() / before - 1.5) < 0.01, 'denying microphone access leaves typed commands functional');
  await page.evaluate(() => { window.voiceTest.denied = false; window.voiceTest.startError = true; });
  await page.locator('[data-roha-control="roha-btn-mic"]').click();
  await page.waitForFunction(() => window.Roha.voice.getState() === 'error');
  check((await reply.textContent()).includes('Voice input did not work'), 'recognition startup failure is visible instead of silently ignored');
  const labels = await page.evaluate(() => {
    const conversation = new window.RohaBundle.ConversationManager();
    const field = {id:'field.name',kind:'field',name:'ስም',fieldType:'text'};
    conversation.loadFields([field]); conversation.proposeAnswer('Sara'); conversation.acceptProposedAnswer();
    conversation.setLocale('en'); conversation.refreshFieldLabels([{...field,name:'Your name'}]);
    return {review:conversation.getFormattedReviewSummary(),answer:conversation.getAllAnswers()['field.name']};
  });
  check(labels.review.includes('Your name') && !labels.review.includes('ስም') && labels.answer === 'Sara', 'translated question labels refresh without losing confirmed answers');
} finally { await browser.close(); }
console.log(`${checks}/${checks} assistant command-flow checks passed (microphone and speech services mocked)`);
