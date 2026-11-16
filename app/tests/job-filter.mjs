/**
 * Automated test suite for the Career Gateway Job Accommodation Filter.
 * Verifies:
 *   1. GET /api/jobs returns active job postings and employer commitments
 *   2. /job displays the dedicated workplace accommodation filter & job listing page
 *   3. Private accommodation matching works reactively (zero disability disclosure)
 *   4. Filter chips and checkboxes satisfy WCAG 2.5.8 (Target Size Minimum >= 24px and 48px touch)
 *   5. Read-aloud button is present on the listing view
 *   6. Clicking 'ይመዝገቡ' (Register) opens the application form for that job
 *   7. The application form shows the selected job banner with a back-to-listings button
 *   8. Clicking 'ወደ ሥራዎች ዝርዝር ተመለስ' returns to the listing page
 *   9. Axe accessibility audit passes with 0 critical/serious issues
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.URL || 'http://127.0.0.1:5173/job';
const API_URL = process.env.API_URL || 'http://127.0.0.1:8080/api/jobs';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

console.log('\n--- 1. API Accommodation Catalog (/api/jobs) ---');
try {
  const res = await fetch(API_URL);
  ok(res.ok, 'GET /api/jobs returns 200 OK', String(res.status));
  const data = await res.json();
  ok(Array.isArray(data.jobs) && data.jobs.length >= 4, 'jobs catalog contains seeded opportunities', `${data.count} jobs`);
  const savanna = data.jobs.find((j) => j.id === 'job-savanna-dev');
  ok(Boolean(savanna), 'finds Savanna accessibility specialist');
  ok(savanna?.accommodations.includes('remote') && savanna?.accommodations.includes('screen-reader'),
     'Savanna offers remote + screen-reader accommodations', savanna?.accommodations.join(', '));
} catch (e) {
  ok(false, 'API fetch failed', e.message);
}

console.log('\n--- 2. Job Listing View & WCAG Target Sizing ---');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });

const listingPage = page.locator('.op-job-listing-page');
ok(await listingPage.count() === 1, 'dedicated job listing view rendered on /job');

const heading = page.locator('h1.op-job-listing-h1');
ok(await heading.count() === 1, 'heading is present on /job listing page');
const headingText = (await heading.innerText()).trim();
ok(headingText.length > 5, 'displays listing page title', headingText);

// Check Read Aloud button on listing page
const readBtn = page.locator('.op-job-listing-header .op-btn-chip, .op-job-listing-header button');
ok(await readBtn.count() >= 1, 'read aloud button is present on listing page');

// Privacy callout banner check
const privacyCard = page.locator('.op-job-filter-privacy-card');
ok(await privacyCard.count() === 1, 'privacy guarantee banner is present');
const privacyText = (await privacyCard.innerText()).trim();
ok(privacyText.length > 20, 'privacy banner states choices stay on device without disability disclosure');

// Check filter checkboxes
const chips = page.locator('.op-job-filter-chip');
const chipCount = await chips.count();
ok(chipCount === 6, 'found all 6 accommodation filter options', `${chipCount} chips`);

const firstCheckbox = page.locator('.op-filter-checkbox').first();
const checkboxBox = await firstCheckbox.boundingBox();
ok(Boolean(checkboxBox && checkboxBox.width >= 24 && checkboxBox.height >= 24),
   'accommodation checkbox meets WCAG 2.5.8 (>= 24x24 px)', `${checkboxBox?.width}x${checkboxBox?.height}px`);

const firstChipBox = await chips.first().boundingBox();
ok(Boolean(firstChipBox && firstChipBox.height >= 48),
   'wrapping filter chip meets 48 px touch target height', `${firstChipBox?.height}px`);

console.log('\n--- 3. Client-Side Accommodation Matching ---');
const cards = page.locator('.op-job-card');
const initialCount = await cards.count();
ok(initialCount === 4, 'initially displays all 4 available jobs', `${initialCount} cards`);

// Check 'Remote work' filter (second chip)
const remoteInput = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(1);
await remoteInput.check();
await page.waitForTimeout(100);

const remoteCount = await page.locator('.op-job-card').count();
ok(remoteCount === 2, 'filtering by Remote work shows matching jobs (2)', `${remoteCount} cards`);

// Check 'Screen-reader software' filter (fourth chip)
const srInput = page.locator('.op-job-filter-chip input[type="checkbox"]').nth(3);
await srInput.check();
await page.waitForTimeout(100);

const bothCount = await page.locator('.op-job-card').count();
ok(bothCount === 2, 'jobs offering both Remote and Screen-reader software match (2)', `${bothCount} cards`);

// Clear filters
const clearBtn = page.locator('.op-filter-clear-btn');
await clearBtn.click();
await page.waitForTimeout(100);
const restoredCount = await page.locator('.op-job-card').count();
ok(restoredCount === 4, 'clearing filters restores all available jobs', `${restoredCount} cards`);

console.log('\n--- 4. Register Transition & Career Gateway Integration ---');
// Click 'ይመዝገቡ' (Register) on the first job card
const registerBtn = page.locator('.op-job-card .op-btn-apply').first();
const regText = (await registerBtn.innerText()).trim();
ok(/ይመዝገቡ|Register|Galmaa'aa|ተመዝገቡ/.test(regText), 'button label is Register / ይመዝገቡ', regText);

await registerBtn.click();
await page.waitForTimeout(200);

// Verify transition into application form
const selectedBanner = page.locator('.op-selected-job-banner');
ok(await selectedBanner.count() === 1, 'selected job banner appears in application flow');
const bannerTitle = await page.locator('.op-selected-job-title').innerText();
ok(bannerTitle.length > 0, 'displays selected job title', bannerTitle);

// Verify form elements are displayed
const formH1 = (await page.locator('#op-q-title').innerText()).trim();
ok(formH1.length > 0, 'application form is open', formH1);

// Test returning back to job listings
const backToListingsBtn = page.locator('.op-btn-change-job');
ok(await backToListingsBtn.count() === 1, 'back to listings button is rendered');
await backToListingsBtn.click();
await page.waitForTimeout(200);

ok(await page.locator('.op-job-listing-page').count() === 1, 'successfully returned to job listings page');

console.log('\n--- 5. Accessibility Audit (Axe-Core) ---');
const { violations } = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();

const severe = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
ok(severe.length === 0, 'axe audit shows 0 serious/critical violations on /job listing page',
   severe.length ? severe.map((v) => v.id).join(', ') : 'clean');

console.log('\n--- 6. Employer Job Submission Appears on /job ---');
const empPage = await context.newPage();
await empPage.goto(URL.replace('/job', '/employer'), { waitUntil: 'networkidle' });

const brandText = (await empPage.locator('.op-brand').innerText()).trim();
ok(brandText === 'የአሰሪ የሥራ ቅጽ' || brandText === 'Employer job form', 'Employer form has updated title', brandText);

const empNext = async () => {
  const btn = empPage.locator('.op-shell form button[type="submit"], .op-shell .op-nav button[type="submit"]').first();
  await btn.click();
  await empPage.waitForTimeout(200);
};

// 1. Language -> Next
await empNext();

// 2. Accessibility prefs -> Next
await empNext();

// 3. Company name
await empPage.locator('.op-shell form .op-input').fill('Digital Bridge Ethiopia');
await empNext();

// 4. Role
await empPage.locator('.op-shell form .op-input').fill('Inclusive Workplace Lead');
await empNext();

// 5. Job category
await empPage.locator('.op-shell form input[type="radio"]').first().check();
await empNext();

// 6. Workplace accommodations
const accInputs = empPage.locator('.op-shell form .op-choice input[type="checkbox"]');
if (await accInputs.count() > 0) {
  await accInputs.nth(0).check();
  if (await accInputs.count() > 1) await accInputs.nth(1).check();
}
await empNext();

// 7. Contact phone
await empPage.locator('.op-shell form .op-input').fill('0911223344');
await empNext();

// 8. Review -> Next
await empNext();

// 9. Submit (check required confirmation checkbox, then submit)
const confirmBox = empPage.locator('.op-shell form input[type="checkbox"]');
if (await confirmBox.count() > 0) {
  await confirmBox.first().check();
}
await empNext();
await empPage.waitForTimeout(600);

// Verify receipt screen and View Jobs link
const viewJobsBtn = empPage.locator('.op-btn-view-jobs, a[href="/job"]');
ok(await viewJobsBtn.count() >= 1, 'receipt offers link to view job board');

// Navigate to /job
await viewJobsBtn.click();
await empPage.waitForTimeout(400);

// Verify new employer job appears on /job
const empJobCard = empPage.locator('.op-job-card', { hasText: 'Digital Bridge Ethiopia' });
ok(await empJobCard.count() === 1, 'newly submitted employer job appears on /job listing');
const empRole = (await empJobCard.locator('.op-job-title').innerText()).trim();
ok(empRole.includes('Inclusive Workplace Lead'), 'job title matches submitted role', empRole);

// Verify clicking Register on the employer job selects it
const empApplyBtn = empJobCard.locator('.op-btn-apply');
await empApplyBtn.click();
await empPage.waitForTimeout(300);

const empSelectedTitle = await empPage.locator('.op-selected-job-title').innerText();
ok(empSelectedTitle.includes('Inclusive Workplace Lead'), 'selected job banner shows employer job', empSelectedTitle);

await browser.close();

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
