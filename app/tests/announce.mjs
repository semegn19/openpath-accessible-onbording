import { chromium } from 'playwright';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173/onboard', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
const live = p.locator('[role="status"][aria-live="polite"]').first();
console.log('initial live region text:', JSON.stringify(await live.innerText()));
await p.getByRole('radio', { name: /English|እንግሊዝኛ/ }).check();
await p.waitForTimeout(150);
console.log('after language change  :', JSON.stringify(await live.innerText()));
await p.getByRole('button', { name: /Next|ቀጣይ/ }).click();
await p.waitForTimeout(200);
const fs = p.locator('.op-fieldset').first();   // accessibility-prefs
await fs.getByRole('checkbox').nth(1).check();   // bigger text
await p.waitForTimeout(200);
console.log('after support "bigger text":', JSON.stringify(await live.innerText()));
// The exclusive-option path ("your other choices were cleared") has no option to exercise it
// in this form any more — `prefer-not` moved out of the preferences. The renderer code stays
// for schemas that declare an exclusive option; it is covered by the validator, not here.
console.log('  exclusive option in this form:', await fs.locator('input[type="checkbox"]').count(), 'checkboxes, none exclusive');
await b.close();
