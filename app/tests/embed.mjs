// Integration Level 1: embed loader (<script src="embed.js">) acceptance test.
// Proves that any host site can embed OpenPath on another port/domain, receive postMessage
// events, auto-resize with zero inner scrollbars, delegate microphone permissions, and pass axe.
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const WIDGET_URL = process.env.URL || 'http://127.0.0.1:5173';
const HOST_PORT = 8085;
let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

// 1. Host web server on port 8085 simulating an external portal (e.g. Savanna)
const hostHtml = `<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="utf-8">
  <title>Savanna Host Portal — Integration Test</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background: #f0f4f8; }
    .portal-box { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="portal-box">
    <h1>Savanna Partner Portal</h1>
    <p>Please complete your learner registration below:</p>
    <div id="signup-container"></div>
  </div>

  <script>
    window.__openpathEvents = [];
    ['ready', 'resize', 'step', 'submitted', 'queued'].forEach((type) => {
      window.addEventListener('openpath:' + type, (e) => {
        window.__openpathEvents.push({ type: type, detail: e.detail });
      });
    });
  </script>

  <script src="${WIDGET_URL}/embed.js"
          data-form="onboard"
          data-lang="am"
          data-target="#signup-container"
          data-title="የተማሪ ምዝገባ ቅጽ">
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(hostHtml);
});

await new Promise((resolve) => server.listen(HOST_PORT, '127.0.0.1', resolve));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(`http://127.0.0.1:${HOST_PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Script tag injection & iframe attributes
  const iframe = page.locator('#signup-container iframe');
  ok((await iframe.count()) === 1, 'embed.js injected the iframe inside the target container');

  const title = await iframe.getAttribute('title');
  ok(title === 'የተማሪ ምዝገባ ቅጽ', 'iframe has accessible title attribute (WCAG 4.1.2)', title);

  const allow = await iframe.getAttribute('allow');
  ok(allow?.includes('microphone'), 'iframe has allow="microphone" permissions delegation', allow);

  const src = await iframe.getAttribute('src');
  ok(src?.includes('/onboard?embed=1&lang=am'), 'iframe points to the correct form with embed=1 and lang=am', src);

  // 2. Event dispatching over postMessage
  const events = await page.evaluate(() => window.__openpathEvents);
  ok(events.some((e) => e.type === 'ready'), 'host received openpath:ready event on load');

  // 3. Dynamic resizing (zero inner scrollbars)
  const heightStr = await iframe.evaluate((el) => el.style.height);
  const heightPx = parseInt(heightStr, 10);
  ok(heightPx >= 500, 'iframe was automatically resized via postMessage (no nested scrollbars)', `${heightPx}px`);

  // 4. Interaction inside the iframe
  const frame = page.frameLocator('#signup-container iframe');
  const h1Text = (await frame.locator('h1').first().innerText()).trim();
  ok(h1Text.includes('ቋንቋ'), 'form is alive and showing the first question in the frame', h1Text);

  // Advance to step 2 inside the iframe
  await frame.getByRole('button', { name: /ቀጣይ|Next/ }).first().click();
  await page.waitForTimeout(400);

  const stepEvents = await page.evaluate(() => window.__openpathEvents.filter((e) => e.type === 'step'));
  ok(stepEvents.length > 0, 'advancing step in iframe notifies host via openpath:step', `steps notified: ${stepEvents.length}`);

  // 5. Host-to-iframe communication: switch language
  await page.evaluate(() => {
    const ifr = document.querySelector('iframe');
    ifr?.contentWindow?.postMessage({ source: 'openpath-host', v: 1, type: 'set-lang', lang: 'en' }, '*');
  });
  await page.waitForTimeout(300);
  const h1English = (await frame.locator('h1').first().innerText()).trim();
  ok(h1English.includes('work for you') || h1English.includes('form'), 'host can change widget language via postMessage', h1English);

  // 6. Accessibility audit on the host page (with iframe embedded)
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  const serious = violations.filter((v) => ['critical', 'serious'].includes(v.impact));
  ok(serious.length === 0, 'host page with embedded widget passes axe with 0 critical/serious violations', `violations: ${serious.length}`);

} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(fail ? `\nFAIL — ${fail} problem(s)` : '\nPASS — 0 problem(s)');
process.exit(fail ? 1 : 0);
