import { chromium } from 'playwright';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

console.log('\n--- 1. Testing Somali Language Support in Browser ---');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto('http://127.0.0.1:5173/job', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1a. Verify Soomaali language button exists in SettingsBar
  const somaliChip = page.locator('.op-lang button:has-text("Soomaali")');
  ok(await somaliChip.count() === 1, 'Soomaali language button exists in settings bar');

  // Click Soomaali button
  await somaliChip.click();
  await page.waitForTimeout(400);

  // Verify HTML lang attribute updated to 'so'
  const htmlLang = await page.getAttribute('html', 'lang');
  ok(htmlLang === 'so', 'Document language updated to "so"', htmlLang);

  // Verify Roha panel updated to Somali
  const rohaHeading = (await page.locator('[data-roha-assistant] h2, aside.roha-panel h2, .roha-header h2').first().innerText()).trim();
  console.log('Roha header in Somali:', rohaHeading);
  ok(rohaHeading.includes('Kaaliyaha') || rohaHeading.includes('Roha'), 'Roha assistant header rendered in Somali');

  // Verify Roha input placeholder in Somali
  const rohaInput = page.locator('#roha-command, [data-roha-control="roha-command"]');
  const placeholder = await rohaInput.getAttribute('placeholder');
  console.log('Roha placeholder in Somali:', placeholder);
  ok(placeholder.includes('caawiyaa') || placeholder.includes('Maxaan'), 'Roha placeholder is in Somali');

  // Verify Roha speech announcement in Somali
  await page.evaluate(async () => {
    const roha = window.Roha || window.rohaInstance;
    if (roha) {
      await roha.handleUserUtterance('jooji');
    }
  });
  await page.waitForTimeout(400);
  const somaliTranscript = await page.evaluate(() => {
    return document.querySelector('[data-roha-control="roha-transcript"]')?.textContent || '';
  });
  console.log('Roha stop command response in Somali:', somaliTranscript);
  ok(somaliTranscript.includes('joojiyay') || somaliTranscript.includes('Waa la joojiyay'), 'Roha responded in Somali to "jooji"');

  console.log('\n--- 1b. Testing Form Question & Options in Somali ---');
  // Check that Job Listing page headers and badges are rendered in Somali
  const listingTitle = (await page.locator('#op-q-title').innerText()).trim();
  console.log('Job listing title in Somali:', listingTitle);
  ok(listingTitle.includes('Raadi') || listingTitle.includes('shaqooyin') || listingTitle.includes('taageerada'), 'Job listing title in Somali');

  const filterLegend = (await page.locator('.op-job-filter-legend').innerText()).trim();
  console.log('Filter legend in Somali:', filterLegend);
  ok(filterLegend.includes('Shaandheeyaha') || filterLegend.includes('taageerada'), 'Filter legend in Somali');

  // Click on the first job card's apply button
  const firstApplyBtn = page.locator('.op-btn-apply').first();
  console.log('Apply button count:', await firstApplyBtn.count());
  if (await firstApplyBtn.count() > 0) {
    await firstApplyBtn.click();
    await page.waitForTimeout(500);

    // Selected job banner in Somali
    const bannerJobTitle = (await page.locator('.op-selected-job-title').innerText()).trim();
    console.log('Selected job title in Somali:', bannerJobTitle);
    ok(bannerJobTitle.length > 0 && !bannerJobTitle.includes('Accessibility & Software Specialist'), 'Job title translated in Somali');

    // On form Step 1 (or Step 2)
    const radio = page.locator('#op-main .op-options input[value="so"]');
    if (await radio.count() > 0) {
      await radio.check();
      await page.waitForTimeout(200);
      await page.locator('#op-main button[type="submit"]').click();
      await page.waitForTimeout(500);
    }

    const step2Title = (await page.locator('#op-q-title').innerText()).trim();
    console.log('Step 2 title in Somali:', step2Title);
    ok(step2Title.includes('Sideed u rabtaa') || step2Title.includes('foomkani'), 'Question rendered in Somali (not English)');

    const stepIndicator = (await page.locator('.op-progress').innerText()).trim();
    console.log('Step indicator in Somali:', stepIndicator);
    ok(stepIndicator.includes('Tallaabada') || stepIndicator.includes('ee'), 'Step indicator rendered in Somali');

    const nextBtn = (await page.locator('#op-main button[type="submit"]').innerText()).trim();
    console.log('Next button in Somali:', nextBtn);
    ok(nextBtn.includes('Hore'), 'Next button rendered in Somali');
  }

  console.log('\n--- 2. Testing Email Dictation Normalization ---');
  // Inject a standard test email input into the main view
  const emailTestResult = await page.evaluate(async () => {
    const container = document.querySelector('#op-main') || document.body;
    const testDiv = document.createElement('div');
    testDiv.id = 'test-email-container';
    testDiv.innerHTML = `
      <form id="test-email-form">
        <label for="job-email">Email</label>
        <input type="email" id="job-email" name="job-email" class="op-input" />
      </form>
    `;
    container.prepend(testDiv);

    const emailInp = document.getElementById('job-email');
    emailInp.focus();

    const roha = window.Roha || window.rohaInstance;
    const results = [];
    const tests = [
      'dog at gmail.com',
      'dog at gmail dot com',
      'my email is alex at yahoo.com',
      'kassa at gmail',
      'john dot doe at outlook dot com'
    ];
    for (const t of tests) {
      results.push({ test: t, val: roha.spokenToEmail ? roha.spokenToEmail(t) : '' });
    }

    // Clean up
    testDiv.remove();
    return results;
  });

  for (const r of emailTestResult) {
    console.log(`Input spoken: "${r.test}" → Result: "${r.val}"`);
    if (r.test === 'dog at gmail.com') ok(r.val === 'dog@gmail.com', 'Normalized "dog at gmail.com"');
    if (r.test === 'dog at gmail dot com') ok(r.val === 'dog@gmail.com', 'Normalized "dog at gmail dot com"');
    if (r.test === 'my email is alex at yahoo.com') ok(r.val === 'alex@yahoo.com', 'Normalized "my email is alex at yahoo.com"');
    if (r.test === 'kassa at gmail') ok(r.val === 'kassa@gmail.com', 'Auto-completed "kassa at gmail" to "kassa@gmail.com"');
    if (r.test === 'john dot doe at outlook dot com') ok(r.val === 'john.doe@outlook.com', 'Normalized "john dot doe at outlook dot com"');
  }

} catch (err) {
  console.error('Test error:', err);
  fail++;
} finally {
  await browser.close();
}

if (fail > 0) {
  console.log(`\nFAILED — ${fail} check(s) failed`);
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED! ✓');
  process.exit(0);
}
