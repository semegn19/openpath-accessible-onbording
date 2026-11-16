import { chromium } from 'playwright';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173/onboard', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
const names = [];
for (let i = 0; i < 14; i++) {
  await p.keyboard.press('Tab');
  names.push(await p.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'null';
    const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 18) || el.getAttribute('name') || '';
    return `${el.tagName.toLowerCase()}${el.getAttribute('type') ? '[' + el.getAttribute('type') + ']' : ''}:${label}`;
  }));
}
console.log(names.map((n, i) => `${i + 1}. ${n}`).join('\n'));
await b.close();
