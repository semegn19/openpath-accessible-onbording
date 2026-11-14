/**
 * One walk through the form, shared by every test.
 *
 * Before this file existed, six tests each re-implemented the same ~15 clicks, so adding a
 * single step broke all six at once and they drifted apart. Add a step HERE and every test
 * follows.
 */
export const LABELS = {
  next: /ቀጣይ|Next|Itti fufi/,
  finish: /ምዝገባውን ጨርስ|Finish|Xumuri|ምዝገባ ወድእ/,
  amharic: /አማርኛ/,
  english: /English|እንግሊዝኛ|Afaan Ingilizii/,
  oromo: /Afaan Oromoo|ኦሮምኛ/,
  tigrinya: /ትግርኛ/,
  agree: /ተስማምቻለሁ|agree|walii nan gala|ተሰማሚዐ ኣለኹ/i,
  callMe: /አዎ፣ ይደውሉልኝ|Yes, call me|Eeyyee, naaf bilbilaa|እወ፣ ደውሉለይ/,
  noThanks: /አይ፣ ራሴ|No, I will fill it myself|Lakki, anumatu guuta|ኣይፋል፣ ባዕለይ ክመልኦ እየ/,
  fayda: /የፋይዳ|Fayda|Faayidaa|ፋይዳ/,
  kebele: /ቀበሌ|Kebele|Gandaa/,
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
  assistance = 'no-thanks', // kept for backwards-compat with callers passing it
  name = 'ሳራ በቀለ ታደሰ',
  phone = '0912345678',
  route = 'fayda',         // fayda | refugee | kebele | other
  idValue = '3910028475',
} = {}) {
  // 1. language
  await page.getByRole('radio', { name: lang === 'am' ? LABELS.amharic : lang === 'om' ? LABELS.oromo : lang === 'ti' ? LABELS.tigrinya : LABELS.english }).check();
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

  // 3. name
  await page.locator('input[type="text"]').first().fill(name);
  await next(page);
  await page.waitForTimeout(120);

  // 4. phone
  await page.locator('input[type="tel"]').fill(phone);
  await next(page);
  await page.waitForTimeout(120);

  // 5. identity route
  const routeLabel = {
    fayda: LABELS.fayda,
    refugee: /ስደተኛ|Refugee/,
    kebele: LABELS.kebele,
    other: /ሌላ ሰነድ|Another document/,
  }[route] || LABELS.fayda;
  await page.getByRole('radio', { name: routeLabel }).check();
  await next(page);
  await page.waitForTimeout(150);

  // 6. conditional: Fayda ID number, or document upload (optional)
  if (route === 'fayda') {
    if (idValue !== null) await page.locator('input[type="text"]').first().fill(idValue);
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

/* ---------- form-agnostic primitives ----------
   `answer()` above walks the onboarding form, so the job and employer tests each grew their own
   walker — and every one of them re-learned the same three traps:

   1. clicking "the first unchecked radio" on the language screen changes the language instead of
      answering the question (the language screen *is* radios);
   2. the preference boxes are checkboxes, not radios, and are found by index;
   3. `.check()` stalls for 30 s on an input that is already checked.

   These helpers encode the answers once. They navigate; they never assert. */

/** The step number from the progress text — the only stable handle across all three forms. */
export const stepNo = async (page) => {
  const txt = await page.locator('.op-progress').innerText();
  return Number((txt.match(/(\d+)/) || [])[1]);
};

/** Walk forward until the progress counter reads `n`. Stops rather than overshoots. */
export async function walkTo(page, n, { fill = true, max = 20 } = {}) {
  for (let i = 0; i < max; i++) {
    const now = await stepNo(page);
    if (!now || now >= n) return now;
    if (fill) await fillVisible(page);
    await next(page);
    await page.waitForTimeout(140);
  }
  return stepNo(page);
}

/** Answer whatever is on screen with something valid, without touching the language choice. */
export async function fillVisible(page, { text = 'Test Person', phone = '0912345678', email = 'test@example.com', number = '3' } = {}) {
  for (const el of await page.$$('.op-root input[type=text], .op-root input[type=tel], .op-root input[type=email], .op-root textarea')) {
    const ty = await el.getAttribute('type');
    await el.fill(ty === 'tel' ? phone : ty === 'email' ? email : text).catch(() => {});
  }
  for (const el of await page.$$('.op-root input[inputmode=numeric]')) await el.fill(number).catch(() => {});
  for (const el of await page.$$('.op-root input[type=radio]:not(:checked)')) {
    if (await el.isVisible().catch(() => false)) { await el.click({ force: true }).catch(() => {}); break; }
  }
}

/**
 * Choose the language. Ticks the language radio by name rather than clicking "the first radio":
 * on step 1 the radios *are* the languages, so a generic click silently switches the form.
 */
export async function setLang(page, lang = 'am') {
  const name = lang === 'am' ? LABELS.amharic : lang === 'om' ? LABELS.oromo : lang === 'ti' ? LABELS.tigrinya : LABELS.english;
  await page.getByRole('radio', { name }).first().check().catch(async () => {
    await page.getByRole('radio', { name }).first().click({ force: true }).catch(() => {});
  });
  await page.waitForTimeout(150);
}

/** Tick preference boxes by index: read-aloud, bigger text, simple words. */
export async function setPrefs(page, prefs = []) {
  const map = { 'read-aloud': 0, 'large-text': 1, 'simple-words': 2 };
  const boxes = page.locator('.op-root input[type=checkbox]');
  for (const p of prefs) if (map[p] !== undefined) await boxes.nth(map[p]).check().catch(() => {});
  await page.waitForTimeout(150);
}
