import { chromium } from 'playwright';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

console.log('\n--- Testing "Roha" Wake-Word Activation ---');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto('http://127.0.0.1:5173/job', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1. Verify wake hint badge is present in the assistant header
  const wakeBadge = page.locator('.roha-wake-pill');
  ok(await wakeBadge.count() > 0, 'Wake hint badge displayed in Roha header');
  const badgeText = (await wakeBadge.first().innerText()).trim();
  console.log('Wake hint badge text:', badgeText);
  ok(badgeText.includes('Roha') || badgeText.includes('ሮሃ'), 'Badge indicates to say "Roha"');

  // 2. Test Wake Word activation in English
  await page.evaluate(async () => {
    const roha = window.Roha || window.rohaInstance;
    if (roha) {
      roha.setLanguage('en');
      roha.handleWakeWordActivation();
    }
  });
  await page.waitForTimeout(400);

  const enTranscript = await page.evaluate(() => {
    return document.querySelector('[data-roha-control="roha-transcript"]')?.textContent || '';
  });
  console.log('Roha response to "Roha" (English):', enTranscript);
  ok(
    enTranscript.includes('Hello') && enTranscript.includes('assist') && enTranscript.includes('register the form'),
    'Roha greeted in English: "Hello! I can assist you to register the form, just say a word."'
  );

  // 3. Test Wake Word activation in Amharic
  await page.evaluate(async () => {
    const roha = window.Roha || window.rohaInstance;
    if (roha) {
      roha.setLanguage('am');
      await roha.handleUserUtterance('ሮሃ');
    }
  });
  await page.waitForTimeout(400);

  const amTranscript = await page.evaluate(() => {
    return document.querySelector('[data-roha-control="roha-transcript"]')?.textContent || '';
  });
  console.log('Roha response to "ሮሃ" (Amharic):', amTranscript);
  ok(
    amTranscript.includes('ሰላም') && amTranscript.includes('ቅጽ') && amTranscript.includes('ይናገሩ'),
    'Roha greeted in Amharic on wake word "ሮሃ"'
  );

  // 4. Test Wake Word activation in Somali
  await page.evaluate(async () => {
    const roha = window.Roha || window.rohaInstance;
    if (roha) {
      roha.setLanguage('so');
      await roha.handleUserUtterance('roha');
    }
  });
  await page.waitForTimeout(400);

  const soTranscript = await page.evaluate(() => {
    return document.querySelector('[data-roha-control="roha-transcript"]')?.textContent || '';
  });
  console.log('Roha response to "roha" (Somali):', soTranscript);
  ok(
    soTranscript.includes('Hayye') && soTranscript.includes('foomkan') && soTranscript.includes('eray'),
    'Roha greeted in Somali on wake word "roha"'
  );

} catch (err) {
  console.error('Test error:', err);
  fail++;
} finally {
  await browser.close();
}

console.log(`\n${fail === 0 ? 'ALL WAKE WORD TESTS PASSED! ✓' : `FAILED — ${fail} check(s) failed`}`);
process.exit(fail ? 1 : 0);
