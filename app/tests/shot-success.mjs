// The screen a judge will ask about: a reference number, and proof the support answers are absent.
import { chromium } from 'playwright';
import { answer, goto, next, submitFromReview } from './_flow.mjs';
const URL = process.env.URL || 'http://127.0.0.1:5173/onboard';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await c.newPage();
await goto(p, URL);
await answer(p, { prefs: ['read-aloud'], assistance: 'call-me' });   // a preference AND a request
await submitFromReview(p);
await p.waitForTimeout(1500);
await p.screenshot({ path: 'screenshots/4-success.png' });
console.log('h1:', (await p.locator('h1').first().innerText()).trim());
console.log('receipt:', (await p.locator('.op-receipt').innerText()).replace(/\s+/g, ' ').trim());
await b.close();
