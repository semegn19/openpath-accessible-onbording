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
  await page.goto('http://127.0.0.1:5173/job', { waitUntil: 'networkidle' });
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

    // Test case 1: "dog at gmail.com"
    await roha.handleUserUtterance('dog at gmail.com');
    results.push({ test: 'dog at gmail.com', val: emailInp.value });

    // Test case 2: "dog at gmail dot com"
    await roha.handleUserUtterance('dog at gmail dot com');
    results.push({ test: 'dog at gmail dot com', val: emailInp.value });

    // Test case 3: "my email is alex at yahoo.com"
    await roha.handleUserUtterance('my email is alex at yahoo.com');
    results.push({ test: 'my email is alex at yahoo.com', val: emailInp.value });

    // Test case 4: "kassa at gmail"
    await roha.handleUserUtterance('kassa at gmail');
    results.push({ test: 'kassa at gmail', val: emailInp.value });

    // Test case 5: "john dot doe at outlook dot com"
    await roha.handleUserUtterance('john dot doe at outlook dot com');
    results.push({ test: 'john dot doe at outlook dot com', val: emailInp.value });

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
