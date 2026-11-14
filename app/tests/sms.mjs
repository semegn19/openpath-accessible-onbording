/**
 * SMS & Checkpoint Resume test suite for OpenPath.
 * Verifies SMSEthiopia (https://smsethiopia.com) SMS integration, checkpoint creation, token resume, and offline drop resume.
 */
import { chromium } from 'playwright';
import { normalizePhone, formatResumeMessage, sendSms } from '../../api/sms.mjs';

const API_PORT = 8080;
const DEV_PORT = 5173;
const API = `http://127.0.0.1:${API_PORT}`;
const SITE = `http://127.0.0.1:${DEV_PORT}`;

let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

console.log('\n=== 1. Phone Normalization & Message Formatting ===');
ok(normalizePhone('0912345678') === '+251912345678', 'normalize local Ethiopian 09 mobile');
ok(normalizePhone('0712345678') === '+251712345678', 'normalize local Safaricom 07 mobile');
ok(normalizePhone('+251920904620') === '+251920904620', 'normalize international format');

const msgAm = formatResumeMessage('https://example.com?resume=xyz', 'am');
ok(msgAm.includes('https://example.com?resume=xyz') && msgAm.includes('OpenPath'), 'Amharic resume message contains URL');

const msgOm = formatResumeMessage('https://example.com?resume=xyz', 'om');
ok(msgOm.includes('https://example.com?resume=xyz') && msgOm.includes('OpenPath'), 'Oromo resume message contains URL');

const msgTi = formatResumeMessage('https://example.com?resume=xyz', 'ti');
ok(msgTi.includes('https://example.com?resume=xyz') && msgTi.includes('OpenPath'), 'Tigrinya resume message contains URL');

console.log('\n=== 2. Checkpoint API Endpoints ===');
const cpRes = await fetch(`${API}/api/checkpoints`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    formId: 'savanna-onboard-v1',
    phone: '+251920904620',
    answers: { language: 'am', name: 'አበበ በቀለ', phone: '0920904620' },
    currentStep: 3,
  }),
});
const cpData = await cpRes.json();
ok(cpRes.ok && cpData.ok && Boolean(cpData.token), 'POST /api/checkpoints creates checkpoint', `token: ${cpData.token?.slice(0, 8)}...`);
ok(cpData.resumeUrl?.includes(`?resume=${cpData.token}`), 'resumeUrl contains resume token', cpData.resumeUrl);

const getRes = await fetch(`${API}/api/checkpoints/${cpData.token}`);
const getData = await getRes.json();
ok(getRes.ok && getData.checkpoint?.answers?.name === 'አበበ በቀለ', 'GET /api/checkpoints/:token retrieves saved answers');

const notFoundRes = await fetch(`${API}/api/checkpoints/invalid-token-12345`);
ok(notFoundRes.status === 404, 'GET /api/checkpoints/:invalid returns 404');

console.log('\n=== 3. SMS Send & Resume Dispatch ===');
const smsRes = await fetch(`${API}/api/sms/send-resume`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+251920904620',
    answers: { language: 'am', name: 'አበበ በቀለ', phone: '0920904620' },
    currentStep: 3,
    lang: 'am',
  }),
});
const smsData = await smsRes.json();
ok(smsRes.ok && smsData.ok && smsData.sms?.ok, 'POST /api/sms/send-resume dispatches or simulates SMS', `provider: ${smsData.sms?.provider}, status: ${smsData.sms?.status}`);

console.log('\n=== 4. Browser Resume from SMS Token ===');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Open the form with resume URL
await page.goto(`${SITE}/onboard?resume=${cpData.token}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const restoredBanner = await page.locator('.op-banner').isVisible().catch(() => false);
ok(restoredBanner, 'restored banner appears when opening resume link');

console.log('\n=== 5. Connection Drop Auto-SMS ===');
// Answer up to phone step
await page.goto(`${SITE}/onboard`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// 1. language
await page.getByRole('radio', { name: /አማርኛ/ }).check();
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(150);

// 2. prefs
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(150);

// 3. name
await page.locator('input[type="text"]').first().fill('ዮናስ ታደሰ');
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(150);

// 4. phone
await page.locator('input[type="tel"]').fill('0920904620');
await page.getByRole('button', { name: /ቀጣይ|Next/ }).click();
await page.waitForTimeout(200);

// Connection drops while on id-route step
await page.context().setOffline(true);
await page.waitForSelector('.op-net', { timeout: 5000 });
await page.waitForTimeout(500);

const netText = await page.locator('.op-net').innerText();
ok(netText.includes('ግንኙነት የለም') || netText.includes('No connection'), 'offline banner is displayed on connection drop');
ok(netText.includes('ማስፈንጠሪያ') || netText.includes('SMS') || netText.includes('resume link'), 'offline banner confirms resume link was sent via SMS');

await browser.close();

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — 0 problem(s) in SMS & Checkpoint tests`);
process.exit(fail ? 1 : 0);
