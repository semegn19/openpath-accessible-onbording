/**
 * One walk through the form, shared by every test.
 *
 * Before this file existed, six tests each re-implemented the same ~15 clicks, so adding a
 * single step broke all six at once and they drifted apart. Add a step HERE and every test
 * follows.
 */
export const LABELS = {
  next: /ቀጣይ|Next/,
  finish: /ምዝገባውን ጨርስ|Finish/,
  amharic: /አማርኛ/,
  english: /English/,
  agree: /ተስማምቻለሁ|agree/i,
  callMe: /አዎ፣ ይደውሉልኝ|Yes, call me/,
  noThanks: /አይ፣ ራሴ|No, I will fill it myself/,
  noDocument: /ምንም መታወቂያ|do not have any/,
  helpChoosing: /የትኛውን እንድመርጥ|need help choosing/,
  fayda: /የፋይዳ|Fayda/,
};

export const goto = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
};

export const next = (page) => page.getByRole('button', { name: LABELS.next }).click();

/** Fill everything up to (not including) the review screen. */
export async function answer(page, {
  lang = 'am',
  prefs = [],              // accessibility-prefs values: read-aloud | large-text | simple-words
  assistance = 'no-thanks',
  name = 'ሳራ በቀለ ታደሰ',
  phone = '0912345678',
  route = 'fayda',         // fayda | refugee | passport | other | no-document | help-choosing
  idValue = '3910028475',
} = {}) {
  // 1. language
  await page.getByRole('radio', { name: lang === 'am' ? LABELS.amharic : LABELS.english }).check();
  await next(page);
  await page.waitForTimeout(120);

  // 2. accessibility preferences (all optional)
  const fieldsets = page.locator('.op-fieldset');
  const prefBoxes = fieldsets.first().getByRole('checkbox');
  for (let i = 0; i < prefs.length; i++) {
    const map = { 'read-aloud': 0, 'large-text': 1, 'simple-words': 2 };
    await prefBoxes.nth(map[prefs[i]]).check();
  }
  await next(page);
  await page.waitForTimeout(120);

  // 3. assistance — always answered explicitly
  await page.getByRole('radio', { name: assistance === 'call-me' ? LABELS.callMe : LABELS.noThanks }).check();
  await next(page);
  await page.waitForTimeout(120);

  // 4. name
  await page.locator('input[type="text"]').first().fill(name);
  await next(page);
  await page.waitForTimeout(120);

  // 5. phone
  await page.locator('input[type="tel"]').fill(phone);
  await next(page);
  await page.waitForTimeout(120);

  // 6. identity route
  const routeLabel = {
    fayda: LABELS.fayda,
    refugee: /ስደተኛ|Refugee/,
    passport: /ፓስፖርት|Passport/,
    other: /ሌላ ሰነድ|Another document/,
    'no-document': LABELS.noDocument,
    'help-choosing': LABELS.helpChoosing,
  }[route];
  await page.getByRole('radio', { name: routeLabel }).check();
  await next(page);
  await page.waitForTimeout(150);

  // 7. conditional: ID number, or the referral consent
  if (route === 'fayda' || route === 'refugee' || route === 'passport' || route === 'other') {
    if (idValue !== null) await page.locator('input[type="text"]').first().fill(idValue);
  } else {
    await page.getByRole('checkbox', { name: LABELS.agree }).first().check();
  }
  await next(page);
  await page.waitForTimeout(150);
}

/** From the review screen: submit. */
export async function submitFromReview(page) {
  await next(page);                       // review → submit
  await page.waitForTimeout(150);
  await page.getByRole('checkbox', { name: LABELS.agree }).first().check();
  await page.getByRole('button', { name: LABELS.finish }).click();
}
