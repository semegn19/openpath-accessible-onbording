import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const browser = await chromium.launch();
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`✓ ${label}`); };
try {
  for (const width of [320, 640]) {
    const context = await browser.newContext({ viewport: { width, height: 640 } });
    const page = await context.newPage();
    await page.goto(`${process.env.ORIGIN || 'http://127.0.0.1:5173'}/onboard`, { waitUntil: 'networkidle' });
    const launcher = page.locator('[data-roha-control="roha-launcher-pill"]');
    await launcher.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    const input = dialog.getByRole('textbox');
    check(await input.evaluate(e => e === document.activeElement), `opening focuses typed input at ${width}px`);
    check(await dialog.locator('button').evaluateAll(buttons => buttons.every(e => {
      const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44;
    })), `all assistant buttons meet 44px product target at ${width}px`);
    const { violations } = await new AxeBuilder({ page }).include('.roha-aside').analyze();
    check(violations.length === 0, `assistant axe clean at ${width}px: ${violations.map(v => v.id)}`);
    await input.fill('bigger text'); await input.press('Enter');
    check(await page.locator('html').getAttribute('data-roha-scale') === '150', 'typed command changes real page text size');
    check(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'dialog reflows after text enlargement');
    await page.keyboard.press('Escape');
    check(await launcher.evaluate(e => e === document.activeElement), 'Escape closes and returns focus to launcher');
    await page.evaluate(() => window.Roha.mount({ root: document.querySelector('main'), language: 'am' }));
    await page.locator('[data-roha-control="roha-launcher-pill"]').click();
    check(await page.getByRole('dialog').getByRole('textbox', { name: 'በምን ልርዳዎት?' }).count() === 1, 'Amharic typed input has a translated accessible label');
    await context.close();
  }
} finally { await browser.close(); }
console.log(`${checks}/${checks} assistant accessibility checks passed`);
