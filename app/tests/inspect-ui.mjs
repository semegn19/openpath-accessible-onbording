import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/onboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const checkState = async (label) => {
  const info = await page.evaluate(() => {
    const bodyClass = document.body.className;
    const bodyDisplay = window.getComputedStyle(document.body).display;
    const panel = document.querySelector('aside.roha-aside, [data-roha-assistant]');
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const consentLabel = document.querySelector('[data-ai-consent-label]');
    const consentInput = document.querySelector('[data-ai-consent]');
    const wakeStatusBadge = document.querySelector('[data-roha-control="roha-voice-status-badge"]')?.textContent;
    return {
      bodyClass,
      bodyDisplay,
      isOnSide: panelRect ? panelRect.x > 800 : false,
      panelX: panelRect ? Math.round(panelRect.x) : 0,
      panelW: panelRect ? Math.round(panelRect.width) : 0,
      consentVisible: consentLabel ? window.getComputedStyle(consentLabel).display !== 'none' && !consentLabel.hidden : false,
      consentChecked: consentInput ? consentInput.checked : false,
      wakeStatusBadge,
    };
  });
  console.log(`[${label}] onSide: ${info.isOnSide} (x=${info.panelX}, w=${info.panelW}), consentVisible: ${info.consentVisible}, consentChecked: ${info.consentChecked}, status: "${info.wakeStatusBadge}"`);
  return info;
};

console.log('Testing Roha layout and consent across all languages:');
await checkState('Initial (Amharic)');

// Click English
await page.click('.op-lang button:has-text("English")');
await page.waitForTimeout(500);
await checkState('English');

// Click Afaan Oromoo
await page.click('.op-lang button:has-text("Afaan Oromoo")');
await page.waitForTimeout(500);
await checkState('Afaan Oromoo');

// Click Tigrinya
await page.click('.op-lang button:has-text("ትግርኛ")');
await page.waitForTimeout(500);
await checkState('Tigrinya');

// Click Soomaali
await page.click('.op-lang button:has-text("Soomaali")');
await page.waitForTimeout(500);
await checkState('Soomaali');

await browser.close();
