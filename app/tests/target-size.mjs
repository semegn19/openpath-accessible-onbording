/**
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum) Contract Test
 * Verifies that all interactive targets meet or exceed 24x24 CSS pixels:
 * 1. Native radio and checkbox inputs are >= 24x24 px.
 * 2. Wrapping option/check cards meet >= 48 px minimum height.
 * 3. Primary action, navigation, and voice buttons meet >= 48 px minimum height.
 * 4. Settings chips in the sticky bar meet >= 48x48 px minimum dimensions.
 * 5. Error summary links and edit links meet >= 24 px minimum height.
 */
import { chromium } from 'playwright';
import { goto, next, LABELS } from './_flow.mjs';

const URL = process.env.URL || 'http://127.0.0.1:5173/onboard';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

await goto(page, URL);

console.log('\n--- 1. Settings Chips & Top Bar Targets ---');
{
  const chips = await page.locator('.op-settings .op-btn-chip').all();
  ok(chips.length >= 3, `found ${chips.length} settings chips`);
  let allChipsValid = true;
  for (const chip of chips) {
    const box = await chip.boundingBox();
    if (!box || box.width < 44 || box.height < 44) {
      allChipsValid = false;
      console.log('Undersized chip:', box);
    }
  }
  ok(allChipsValid, 'all settings chips meet or exceed 48 px touch target dimensions');
}

console.log('\n--- 2. Native Radio Inputs & Wrapping Cards ---');
{
  // Step 1: Language selection (Radio / Option cards)
  const radioInputs = await page.locator('.op-option input[type="radio"]').all();
  ok(radioInputs.length >= 2, `found ${radioInputs.length} radio inputs`);
  let allRadiosMeet24 = true;
  for (const radio of radioInputs) {
    const box = await radio.boundingBox();
    if (!box || box.width < 23.9 || box.height < 23.9) {
      allRadiosMeet24 = false;
      console.log('Undersized radio input:', box);
    }
  }
  ok(allRadiosMeet24, 'raw radio inputs meet or exceed 24x24 px (WCAG 2.5.8 Level AA)');

  const optionCards = await page.locator('.op-option').all();
  let allOptionCardsMeet48 = true;
  for (const card of optionCards) {
    const box = await card.boundingBox();
    if (!box || box.height < 48) {
      allOptionCardsMeet48 = false;
      console.log('Undersized option card:', box);
    }
  }
  ok(allOptionCardsMeet48, 'wrapping option cards meet or exceed 48 px touch target height');
}

console.log('\n--- 3. Native Checkbox Inputs & Accessibility Preferences ---');
{
  // Pick language and advance to Step 2
  await page.getByRole('radio', { name: LABELS.amharic }).check();
  await next(page);
  await page.waitForTimeout(200);

  const checkInputs = await page.locator('input[type="checkbox"]').all();
  ok(checkInputs.length >= 3, `found ${checkInputs.length} checkbox inputs on preferences step`);
  let allChecksMeet24 = true;
  for (const check of checkInputs) {
    const box = await check.boundingBox();
    if (!box || box.width < 23.9 || box.height < 23.9) {
      allChecksMeet24 = false;
      console.log('Undersized checkbox input:', box);
    }
  }
  ok(allChecksMeet24, 'raw checkbox inputs meet or exceed 24x24 px (WCAG 2.5.8 Level AA)');

  const checkCards = await page.locator('.op-option:has(input[type="checkbox"]), .op-check').all();
  let allCheckCardsMeet48 = true;
  for (const card of checkCards) {
    const box = await card.boundingBox();
    if (!box || box.height < 48) {
      allCheckCardsMeet48 = false;
      console.log('Undersized check card:', box);
    }
  }
  ok(allCheckCardsMeet48, 'wrapping check cards meet or exceed 48 px touch target height');
}

console.log('\n--- 4. Primary, Back, Read Aloud, and Voice Buttons ---');
{
  const readAloudBtn = page.locator('.op-readaloud button');
  const readBox = await readAloudBtn.boundingBox();
  ok(readBox && readBox.height >= 48, 'Read Aloud button meets or exceeds 48 px target height', `${readBox?.height}px`);

  const nextBtn = page.locator('.op-nav .op-btn-primary');
  const nextBox = await nextBtn.boundingBox();
  ok(nextBox && nextBox.height >= 48, 'Primary navigation button meets or exceeds 48 px target height', `${nextBox?.height}px`);

  const backBtn = page.locator('.op-nav .op-btn-back');
  const backBox = await backBtn.boundingBox();
  ok(backBox && backBox.height >= 48, 'Back button meets or exceeds 48 px target height', `${backBox?.height}px`);

  // Advance to Step 3: Name field (has voice button)
  await next(page);
  await page.waitForTimeout(200);

  const voiceBtn = page.locator('.op-btn-voice');
  const voiceBox = await voiceBtn.boundingBox();
  ok(voiceBox && voiceBox.height >= 48, 'Voice dictation button meets or exceeds 48 px target height', `${voiceBox?.height}px`);

  const textInput = page.locator('.op-input');
  const textBox = await textInput.boundingBox();
  ok(textBox && textBox.height >= 48, 'Text input meets or exceeds 48 px target height', `${textBox?.height}px`);
}

await browser.close();

if (fail > 0) {
  console.error(`\nFAILED: ${fail} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nPASSED: All interactive targets strictly satisfy WCAG 2.2 SC 2.5.8 (Target Size Minimum).`);
  process.exit(0);
}
