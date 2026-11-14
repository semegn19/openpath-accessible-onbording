// Integration Level 3: schema.org/JobPosting JSON-LD acceptance test.
// Validates:
// 1. GET /api/forms/:id/jsonld returns valid Schema.org JobPosting for employer forms
// 2. GET /api/forms/:id/jsonld rejects non-job forms with 422
// 3. GET /api/submissions/:id/jsonld returns concrete JobPosting with accommodations
// 4. Zero PII contract: Contact phone numbers and applicant health data are never in JSON-LD
// 5. Client DOM integration: <script id="openpath-jsonld" type="application/ld+json"> is injected
//    on /employer, updates reactively, and is removed on /onboard.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const API_PORT = process.env.API_PORT || 8080;
const API = `http://127.0.0.1:${API_PORT}/api`;
const PAGE_URL = process.env.URL || 'http://127.0.0.1:5173';

let fail = 0;
const ok = (c, label, extra = '') => {
  if (!c) fail++;
  console.log(`${c ? '✓' : '✗'} ${label}${extra ? ' → ' + extra : ''}`);
};

// Ensure API server is up (either existing background server or scratch spawn)
let child = null;
const up = await fetch(`${API}/health`).then((r) => r.ok).catch(() => false);
if (!up) {
  child = spawn('node', ['../api/server.mjs'], {
    env: {
      ...process.env,
      PORT: String(API_PORT),
      DATA_DIR: mkdtempSync(join(tmpdir(), 'openpath-jsonld-')),
      SCHEMA_DIR: fileURLToPath(new URL('../../schema', import.meta.url)),
      RATE_LIMIT_PER_MIN: '1000',
      TRUST_PROXY: '0',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${API}/health`).then((r) => r.ok).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
}
process.on('exit', () => child?.kill('SIGKILL'));

/* -------------------------------------------------- 1. Form JSON-LD Endpoint */
{
  const res = await fetch(`${API}/forms/employer-accommodations-v1/jsonld`);
  ok(res.status === 200, 'GET /forms/employer-accommodations-v1/jsonld → 200');
  const ct = res.headers.get('content-type') || '';
  ok(ct.includes('application/ld+json'), 'Content-Type is application/ld+json', ct);

  const doc = await res.json();
  ok(doc['@context'] === 'https://schema.org', '@context is https://schema.org', doc['@context']);
  ok(doc['@type'] === 'JobPosting', '@type is JobPosting', doc['@type']);
  ok(typeof doc.title === 'string' && doc.title.length > 0, 'Job title is present', doc.title);
  ok(doc.hiringOrganization?.['@type'] === 'Organization', 'hiringOrganization is Organization');
  ok(doc.jobLocation?.['@type'] === 'Place', 'jobLocation is Place');
  ok(doc.directApply === true, 'directApply is true');
  ok(Array.isArray(doc.jobBenefits) && doc.jobBenefits.length > 0, 'jobBenefits lists accommodations', `${doc.jobBenefits?.length} items`);
  ok(typeof doc.accessibilitySummary === 'string' && doc.accessibilitySummary.includes('accommodations'), 'accessibilitySummary is human-readable');

  // Amharic localization
  const resAm = await fetch(`${API}/forms/employer-accommodations-v1/jsonld?lang=am`);
  const docAm = await resAm.json();
  ok(resAm.status === 200, 'GET /forms/employer-accommodations-v1/jsonld?lang=am → 200');
  ok(docAm.title.includes('የሥራ') || docAm.title.includes('ምዝገባ'), 'Amharic title localized', docAm.title);
  ok(docAm.accessibilitySummary.includes('ተደራሽነት') || docAm.accessibilitySummary.includes('ማመቻቸት'), 'Amharic summary localized');

  // Afaan Oromoo localization
  const resOm = await fetch(`${API}/forms/employer-accommodations-v1/jsonld?lang=om`);
  const docOm = await resOm.json();
  ok(resOm.status === 200, 'GET /forms/employer-accommodations-v1/jsonld?lang=om → 200');
  ok(docOm.title.includes('hojii') || docOm.title.includes('Galmee') || docOm.title.includes('mijataa'), 'Afaan Oromoo title localized', docOm.title);
  ok(docOm.accessibilitySummary.includes("Mijaa'ina") || docOm.accessibilitySummary.includes('hojii'), 'Afaan Oromoo summary localized');

  // Tigrinya localization
  const resTi = await fetch(`${API}/forms/employer-accommodations-v1/jsonld?lang=ti`);
  const docTi = await resTi.json();
  ok(resTi.status === 200, 'GET /forms/employer-accommodations-v1/jsonld?lang=ti → 200');
  ok(docTi.title.includes('ስራሕ') || docTi.title.includes('ምዝገባ'), 'Tigrinya title localized', docTi.title);
  ok(docTi.accessibilitySummary.includes('ተበጻሕነት') || docTi.accessibilitySummary.includes('ምምዕርራይ'), 'Tigrinya summary localized');

  // Negative tests
  const resOnboard = await fetch(`${API}/forms/savanna-onboard-v1/jsonld`);
  ok(resOnboard.status === 422, 'Non-job form returns 422 not-supported', String(resOnboard.status));
  const resMissing = await fetch(`${API}/forms/does-not-exist/jsonld`);
  ok(resMissing.status === 404, 'Unknown form returns 404', String(resMissing.status));
}

/* ------------------------------------------- 2. Submission JSON-LD & Zero PII */
let employerSubId = '';
{
  const submitRes = await fetch(`${API}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formId: 'employer-accommodations-v1',
      answers: {
        language: 'en',
        company: 'Ethio Tech Innovation',
        role: 'Senior Accessibility Engineer',
        'job-category': 'it',
        accommodations: ['step-free', 'remote', 'flexible', 'screen-reader'],
        contact: '0912345678',
        submit: ['confirm-true'],
      },
    }),
  });
  const subData = await submitRes.json();
  employerSubId = subData.id;
  ok(submitRes.status === 201 && !!employerSubId, 'POST employer submission created', employerSubId);

  const resSubJsonLd = await fetch(`${API}/submissions/${employerSubId}/jsonld`);
  ok(resSubJsonLd.status === 200, 'GET /submissions/:id/jsonld → 200');
  const ct = resSubJsonLd.headers.get('content-type') || '';
  ok(ct.includes('application/ld+json'), 'Content-Type is application/ld+json', ct);

  const subLd = await resSubJsonLd.json();
  ok(subLd['@context'] === 'https://schema.org', 'Submission @context is https://schema.org');
  ok(subLd['@type'] === 'JobPosting', 'Submission @type is JobPosting');
  ok(subLd.title === 'Senior Accessibility Engineer', 'Job title matches submitted role', subLd.title);
  ok(subLd.hiringOrganization?.name === 'Ethio Tech Innovation', 'Organization name matches company', subLd.hiringOrganization?.name);
  ok(subLd.occupationalCategory === 'Computer and Information Technology', 'Category mapped to occupation', subLd.occupationalCategory);
  ok(subLd.jobLocationType === 'TELECOMMUTE', 'Telecommute set when remote accommodation selected');
  ok(subLd.applicantLocationRequirements?.name === 'Ethiopia', 'Applicant location requirements specified');

  const benefits = subLd.jobBenefits || [];
  ok(benefits.includes('Step-free entrance'), 'Includes Step-free entrance');
  ok(benefits.includes('Remote work'), 'Includes Remote work');
  ok(benefits.includes('Flexible hours'), 'Includes Flexible hours');
  ok(benefits.includes('Screen-reader software'), 'Includes Screen-reader software');

  // Zero-PII assertions
  const rawString = JSON.stringify(subLd);
  ok(!rawString.includes('0912345678'), 'Phone number is NOT in JSON-LD');
  ok(!rawString.includes('+251912345678'), 'Normalized phone number is NOT in JSON-LD');
  ok(!('contact' in subLd), 'contact field is absent from JSON-LD');
  ok(!('accessibility-prefs' in subLd), 'accessibility-prefs is absent from JSON-LD');
}

/* ------------------------------------------- 3. Browser DOM JSON-LD Injection */
{
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Visit employer page
  await page.goto(`${PAGE_URL}/employer`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // Check script tag exists
  const scriptContent = await page.evaluate(() => {
    const el = document.getElementById('openpath-jsonld');
    return el ? el.textContent : null;
  });
  ok(scriptContent !== null, 'Browser DOM has <script id="openpath-jsonld" type="application/ld+json"> on /employer');

  let parsed = null;
  try {
    parsed = JSON.parse(scriptContent || '{}');
  } catch {}
  ok(parsed?.['@context'] === 'https://schema.org', 'DOM JSON-LD @context is https://schema.org');
  ok(parsed?.['@type'] === 'JobPosting', 'DOM JSON-LD @type is JobPosting');
  ok(parsed?.directApply === true, 'DOM JSON-LD directApply is true');

  // Navigate to /onboard and ensure script is cleaned up
  await page.goto(`${PAGE_URL}/onboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const scriptOnOnboard = await page.evaluate(() => document.getElementById('openpath-jsonld'));
  ok(scriptOnOnboard === null, 'Script tag cleanly removed when navigating away to /onboard');

  await browser.close();
}

console.log(`\n${fail ? 'FAIL' : 'PASS'} — ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
