// WCAG 2.2 SC 2.4.11 "Focus Not Obscured (Minimum)": a sticky bar must never sit on top of
// whatever has keyboard focus. This walks every stop and compares it to the sticky bar.
import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:5173/onboard';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 400 } });  // short window = worst case
const p = await c.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });

const barBottom = await p.evaluate(() => {
  const bar = document.querySelector('.op-settingsbar');
  return bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
});
console.log('sticky bar bottom:', barBottom, 'px');

let obscured = [];
for (let i = 0; i < 14; i++) {
  await p.keyboard.press('Tab');
  const info = await p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    // a control INSIDE the sticky bar is not obscured by it — it is the bar
    if (el.closest('.op-settingsbar')) return { label: '(inside the bar)', top: -1, bottom: -1, h: 0, sticky: 'inbar' };
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 28),
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      sticky: style.position,
    };
  });
  if (!info) continue;
  const hidden = info.sticky !== 'inbar' && info.sticky !== 'sticky' && info.h > 0
    && info.top < barBottom && info.bottom > barBottom;   // fully or partly under the bar
  if (hidden) obscured.push(`${info.label} @${info.top}-${info.bottom}`);
  console.log(`${hidden ? '✗' : '·'} ${String(info.top).padStart(5)}–${String(info.bottom).padEnd(5)} ${info.label}`);
}
await b.close();
console.log(obscured.length ? `\n✗ FAIL — ${obscured.length} focused element(s) under the sticky bar: ${obscured.join('; ')}` : '\n✓ PASS — nothing focused is hidden by the sticky bar');
process.exit(obscured.length ? 1 : 0);
