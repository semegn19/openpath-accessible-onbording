import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/onboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const inspect = async (label) => {
  const data = await page.evaluate(() => {
    const bodyClass = document.body.className;
    const panel = document.querySelector('aside.roha-aside, [data-roha-assistant]');
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const rootRect = document.querySelector('#root')?.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(document.body);
    const panelStyle = panel ? window.getComputedStyle(panel) : null;
    const allPanels = document.querySelectorAll('aside.roha-aside, [data-roha-assistant]').length;
    return {
      allPanels,
      bodyClass,
      bodyDisplay: bodyStyle.display,
      bodyGridCols: bodyStyle.gridTemplateColumns,
      panelRect: panelRect ? { x: Math.round(panelRect.x), y: Math.round(panelRect.y), w: Math.round(panelRect.width), h: Math.round(panelRect.height) } : null,
      rootRect: rootRect ? { x: Math.round(rootRect.x), y: Math.round(rootRect.y), w: Math.round(rootRect.width), h: Math.round(rootRect.height) } : null,
      panelGridCol: panelStyle ? panelStyle.gridColumn : null,
      panelGridRow: panelStyle ? panelStyle.gridRow : null,
    };
  });
  console.log(`\n=== [${label}] ===`);
  console.log(JSON.stringify(data, null, 2));
  return data;
};

await inspect('1. Onboard Screen 1 (Initial Amharic)');

// Click English in Settings Bar
console.log('-> Clicking English chip in settings bar...');
await page.click('.op-lang button:has-text("English")');
await page.waitForTimeout(1000);
await inspect('2. Screen 1 after English chip clicked');

// Click Afaan Oromoo in Settings Bar
console.log('-> Clicking Afaan Oromoo chip in settings bar...');
await page.click('.op-lang button:has-text("Afaan Oromoo")');
await page.waitForTimeout(1000);
await inspect('3. Screen 1 after Oromo chip clicked');

// Select an option on Screen 1: Afaan Oromoo
console.log('-> Selecting Afaan Oromoo radio option on form...');
await page.click('label.op-choice:has-text("Afaan Oromoo"), .op-options label:has-text("Afaan Oromoo")');
await page.waitForTimeout(500);

// Click Next
console.log('-> Clicking Next button...');
await page.click('button[type="submit"]');
await page.waitForTimeout(1000);
await inspect('4. Screen 2 (Initial after Next)');

// On Screen 2, click English chip in settings bar
console.log('-> On Screen 2, clicking English chip in settings bar...');
await page.click('.op-lang button:has-text("English")');
await page.waitForTimeout(1000);
await inspect('5. Screen 2 after English clicked');

// On Screen 2, click Tigrinya chip in settings bar
console.log('-> On Screen 2, clicking Tigrinya chip in settings bar...');
await page.click('.op-lang button:has-text("ትግርኛ")');
await page.waitForTimeout(1000);
await inspect('6. Screen 2 after Tigrinya clicked');

await browser.close();
