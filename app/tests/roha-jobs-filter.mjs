import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5173/job';
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Verify page and filter chips exist
  const chips = page.locator('.op-job-filter-chip');
  ok(await chips.count() === 6, 'Found 6 accommodation filter chips');

  // Verify initial jobs count = 4
  const initialCards = page.locator('.op-job-card');
  ok(await initialCards.count() === 4, 'Initially 4 jobs displayed');

  // Helper to ask Roha
  const askRoha = async (utterance) => {
    await page.evaluate(async (utt) => {
      const roha = window.Roha || window.rohaInstance;
      if (roha) {
        await roha.handleUserUtterance(utt);
      } else {
        const input = document.querySelector('#roha-command, [data-roha-control="roha-command"]');
        if (input) {
          input.value = utt;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const form = input.closest('form');
          if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
      }
    }, utterance);
  };

  // Helper to read latest spoken announcement from Roha
  const getLatestSpoken = async () => {
    return await page.evaluate(() => {
      const transcript = document.querySelector('[data-roha-control="roha-transcript"]')?.textContent || '';
      const live = document.querySelector('[data-roha-control="roha-live-region"]')?.textContent || '';
      return transcript || live || '';
    });
  };

  // TEST 1: Single filter command: "ከቤት መሥራት"
  console.log('\n--- Test 1: Single Filter "ከቤት መሥራት" ---');
  await askRoha('ከቤት መሥራት');
  await page.waitForTimeout(500);

  const remoteCheckbox = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(1);
  ok(await remoteCheckbox.isChecked(), 'Remote work checkbox is checked');

  let cardsCount = await page.locator('.op-job-card').count();
  ok(cardsCount === 2, 'Filtered to 2 jobs matching Remote work', `${cardsCount} cards`);

  let spoken = await getLatestSpoken();
  console.log('Spoken:', spoken);
  ok(spoken.includes('2 የሚስማሙ') && spoken.includes('ተገኝተዋል'),
     'Roha announced matching job count (2)');

  // TEST 2: Add second filter sequentially: "ተለዋዋጭ ሰዓት"
  console.log('\n--- Test 2: Add Second Filter Sequentially "ተለዋዋጭ ሰዓት" ---');
  await askRoha('ተለዋዋጭ ሰዓት');
  await page.waitForTimeout(500);

  const flexCheckbox = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(2);
  ok(await remoteCheckbox.isChecked(), 'Remote work is STILL checked (multi-filter)');
  ok(await flexCheckbox.isChecked(), 'Flexible hours is ALSO checked');

  cardsCount = await page.locator('.op-job-card').count();
  ok(cardsCount === 1, 'Only 1 job matches BOTH Remote + Flexible (Savanna)', `${cardsCount} card`);

  spoken = await getLatestSpoken();
  console.log('Spoken:', spoken);
  ok(spoken.includes('1 የሚስማሙ') || spoken.includes('Savanna') || spoken.includes('የተደራሽነትና'),
     'Roha announced Savanna job');

  // TEST 3: Clear filters: "ሁሉንም አሳይ"
  console.log('\n--- Test 3: Clear Filters "ሁሉንም አሳይ" ---');
  await askRoha('ሁሉንም አሳይ');
  await page.waitForTimeout(500);

  ok(!(await remoteCheckbox.isChecked()), 'Remote work is unchecked');
  ok(!(await flexCheckbox.isChecked()), 'Flexible hours is unchecked');
  cardsCount = await page.locator('.op-job-card').count();
  ok(cardsCount === 4, 'All 4 jobs restored', `${cardsCount} cards`);

  // TEST 4: Multi-filter in a single sentence: "ደረጃ የሌለው መግቢያ እና ምቹ የሥራ ጠረጴዛ"
  console.log('\n--- Test 4: Multi-Filter in Single Phrase (Amharic) ---');
  await askRoha('ደረጃ የሌለው መግቢያ እና ምቹ የሥራ ጠረጴዛ');
  await page.waitForTimeout(500);

  const stepFreeCheckbox = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(0);
  const deskCheckbox = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(5);
  ok(await stepFreeCheckbox.isChecked(), 'Step-free entrance is checked');
  ok(await deskCheckbox.isChecked(), 'Adapted desk is checked');

  cardsCount = await page.locator('.op-job-card').count();
  ok(cardsCount === 2, '2 jobs match step-free + desk (LIWAY & ALX)', `${cardsCount} cards`);

  spoken = await getLatestSpoken();
  console.log('Spoken:', spoken);
  ok(spoken.includes('LIWAY') || spoken.includes('የቢሮ አስተዳደር') || spoken.includes('2 የሚስማሙ'),
     'Roha read out matched job title and company');

  // TEST 5: English multi-filter: "remote and flexible hours"
  console.log('\n--- Test 5: Multi-Filter in English ---');
  await askRoha('clear');
  await page.waitForTimeout(400);

  await askRoha('remote and flexible hours');
  await page.waitForTimeout(500);
  ok(await remoteCheckbox.isChecked(), 'English remote checked');
  ok(await flexCheckbox.isChecked(), 'English flexible hours checked');
  cardsCount = await page.locator('.op-job-card').count();
  ok(cardsCount === 1, '1 job matched for English multi-filter', `${cardsCount} card`);

  // TEST 6: Read jobs command: "ስራዎቹን አንብብ"
  console.log('\n--- Test 6: Read Jobs Command ---');
  await askRoha('ስራዎቹን አንብብ');
  await page.waitForTimeout(400);
  spoken = await getLatestSpoken();
  console.log('Readout:', spoken);
  ok(spoken.includes('Savanna') || spoken.includes('የተደራሽነትና'),
     'Readout contains Savanna job details');

  // TEST 7: Afaan Oromoo multi-filter: "mana taa'anii fi sa'aatii jijjiiramaa"
  console.log('\n--- Test 7: Afaan Oromoo Multi-Filter ---');
  await askRoha('clear');
  await page.waitForTimeout(400);
  await askRoha("mana taa'anii fi sa'aatii jijjiiramaa");
  await page.waitForTimeout(500);
  ok(await remoteCheckbox.isChecked(), 'Oromo remote checked');
  ok(await flexCheckbox.isChecked(), 'Oromo flexible checked');
  spoken = await getLatestSpoken();
  console.log('Oromo readout:', spoken);
  ok(spoken.includes('Savanna') || spoken.includes('walsiman') || spoken.includes('filatameera'),
     'Oromo speech announced');

  // TEST 8: Tigrinya multi-filter: "ካብ ገዛ ምስራሕ ምስ ተለዋዋጢ ሰዓታት"
  console.log('\n--- Test 8: Tigrinya Multi-Filter ---');
  await askRoha('clear');
  await page.waitForTimeout(400);
  await askRoha('ካብ ገዛ ምስራሕ ምስ ተለዋዋጢ ሰዓታት');
  await page.waitForTimeout(500);
  ok(await remoteCheckbox.isChecked(), 'Tigrinya remote checked');
  ok(await flexCheckbox.isChecked(), 'Tigrinya flexible checked');
  spoken = await getLatestSpoken();
  console.log('Tigrinya readout:', spoken);
  ok(spoken.includes('Savanna') || spoken.includes('ዝሰማምዑ') || spoken.includes('ተመሪጹ'),
     'Tigrinya speech announced');

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
