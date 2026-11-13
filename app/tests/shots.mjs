import { chromium } from 'playwright';
import { answer, goto, next, submitFromReview } from './_flow.mjs';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

await p.screenshot({ path: 'screenshots/1-language.png' });

// error state on step 1
await p.getByRole('button', { name: /ቀጣይ|Next/ }).click();   // error state on step 1
await p.waitForTimeout(250);
await p.screenshot({ path: 'screenshots/2-error.png' });

// report the computed colours that actually matter
const colours = await p.evaluate(() => {
  const cs = (sel, prop = 'color') => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : 'absent';
  };
  return {
    errorSummaryBorder: cs('.op-error-summary', 'borderTopColor'),
    errorSummaryBg: cs('.op-error-summary', 'backgroundColor'),
    errorSummaryLink: cs('.op-error-summary a'),
    errorSummaryTitle: cs('.op-error-title'),
    bandBg: cs('.op-band', 'backgroundColor'),
    primaryButton: cs('.op-btn-primary', 'backgroundColor'),
    radioAccent: cs('.op-option input', 'accentColor'),
    selectedCardBorder: cs('.op-option', 'borderTopColor'),
    privateNote: cs('.op-private'),
  };
});
console.log(colours);
await b.close();
