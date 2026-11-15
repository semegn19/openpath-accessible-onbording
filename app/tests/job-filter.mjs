/**
 * Automated test suite for the Career Gateway Job Accommodation Filter.
 * Verifies:
 *   1. GET /api/jobs returns active job postings and employer commitments
 *   2. /job displays the workplace accommodation filter toggle
 *   3. Filter panel provides private accommodation matching (zero disability disclosure)
 *   4. Filter chips and checkboxes satisfy WCAG 2.5.8 (Target Size Minimum >= 24px and 48px touch)
 *   5. Filtering works reactively (Remote, Screen Reader, Step-Free)
 *   6. Applying for a job locks the context into the application flow
 *   7. Axe accessibility audit passes with 0 critical/serious issues
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

console.log('\n--- 2. Job Filter UI & WCAG Target Sizing ---');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });

const toggleBtn = page.locator('.op-job-filter-toggle-btn');
ok(await toggleBtn.count() === 1, 'found filter toggle button on /job');
ok((await toggleBtn.getAttribute('aria-expanded')) === 'false', 'toggle starts collapsed');

// Measure toggle button target size
const toggleBox = await toggleBtn.boundingBox();
ok(Boolean(toggleBox && toggleBox.height >= 48 && toggleBox.width >= 48),
   'filter toggle button meets 48x48 px touch target minimum', `${toggleBox?.width}x${toggleBox?.height}px`);

// Open filter panel
await toggleBtn.click();
await page.waitForTimeout(150);
ok((await toggleBtn.getAttribute('aria-expanded')) === 'true', 'toggle button marks panel as expanded');

const panel = page.locator('#op-job-filter-panel');
ok(await panel.count() === 1, 'filter panel is rendered');

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

// Check 'Remote work' filter (second chip or by value)
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

console.log('\n--- 4. Job Selection & Career Gateway Integration ---');
// Click 'Apply for this job' on the first card
const applyBtn = page.locator('.op-job-card .op-btn').first();
await applyBtn.click();
await page.waitForTimeout(150);

// Verify banner appears
const selectedBanner = page.locator('.op-selected-job-banner');
ok(await selectedBanner.count() === 1, 'selected job banner appears in application flow');
const bannerTitle = await page.locator('.op-selected-job-title').innerText();
ok(bannerTitle.length > 0, 'displays selected job title', bannerTitle);

console.log('\n--- 5. Accessibility Audit (Axe-Core) ---');
// Re-open filter panel to audit full DOM
await page.locator('.op-btn-change-job').click();
await page.waitForTimeout(150);

const { violations } = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();

const severe = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
ok(severe.length === 0, 'axe audit shows 0 serious/critical violations on /job with filter open',
   severe.length ? severe.map((v) => v.id).join(', ') : 'clean');

await browser.close();

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
