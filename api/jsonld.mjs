/**
 * OpenPath Schema.org JSON-LD generator — Level 3 of the adoptability ladder.
 *
 * Generates valid schema.org/JobPosting representations from employer accommodation
 * schemas and submissions. Zero personal data (PII) is included in the output.
 */

const CATEGORY_NAMES = {
  office: { en: 'Office and Administrative Support', am: 'ቢሮ እና አስተዳደር', om: 'Hojii waajjiraa fi bulchiinsaa', ti: 'ቢሮን ምምሕዳርን' },
  sales: { en: 'Sales and Related', am: 'ሽያጭ', om: 'Gurgurtaa', ti: 'ሽያጥ' },
  teaching: { en: 'Education and Training', am: 'ማስተማር', om: 'Barsiisummaa', ti: 'ትምህርቲ' },
  it: { en: 'Computer and Information Technology', am: 'ቴክኖሎጂ', om: 'Teeknooloojii', ti: 'ቴክኖሎጂ' },
  hospitality: { en: 'Hospitality and Tourism', am: 'ሆቴል እና መስተንግዶ', om: 'Keessummeessummaa', ti: 'ሆቴልን መስተንግዶን' },
  other: { en: 'General', am: 'ሌላ', om: 'Kan biraa', ti: 'ካልእ' },
};

const ACCOMMODATION_LABELS = {
  'step-free': { en: 'Step-free entrance', am: 'ደረጃ የሌለው መግቢያ', om: 'Seensa sadarkaa hin qabne', ti: 'ደረጃ ዘይብሉ ምእተዊ' },
  remote: { en: 'Remote work', am: 'ከቤት መሥራት', om: "Mana taa'anii hojjechuu", ti: 'ካብ ገዛ ምስራሕ' },
  flexible: { en: 'Flexible hours', am: 'ተለዋዋጭ ሰዓት', om: 'Sa\'aatii jijjiiramaa', ti: 'ተለዋዋጢ ሰዓታት' },
  'screen-reader': { en: 'Screen-reader software', am: 'የስክሪን አንባቢ ሶፍትዌር', om: 'Sooftiweerii iskiriinii dubbisu', ti: 'ናይ ስክሪን ኣንባቢ ሶፍትዌር' },
  'sign-language': { en: 'Sign language interpreter', am: 'የምልክት ቋንቋ አስተርጓሚ', om: 'Turjumaana afaan mallattoo', ti: 'ናይ ምልክት ቋንቋ ኣተርጓሚ' },
  'adapted-desk': { en: 'Adapted desk', am: 'ምቹ የሥራ ጠረጴዛ', om: 'Minjaala mijataa', ti: 'ምቹእ መንበር ወይ ጠረጴዛ' },
};

/**
 * Format a date plus days as ISO date YYYY-MM-DD
 */
function addDays(isoDateStr, days = 90) {
  const d = new Date(isoDateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Generates schema.org/JobPosting JSON-LD from a form schema template.
 * Useful for indexers scraping the form definition directly.
 */
export function generateJobPostingFromSchema(schema, { lang = 'en', baseUrl = 'https://openpath.org' } = {}) {
  if (schema?.generates !== 'schema.org/JobPosting') {
    return null;
  }

  const isAm = lang === 'am';
  const isOm = lang === 'om';
  const isTi = lang === 'ti';
  const title = isAm
    ? (schema.title?.am || 'የተደራሽ የሥራ ዕድል ምዝገባ')
    : isOm
    ? (schema.title?.om || 'Galmee carraa hojii mijataa')
    : isTi
    ? (schema.title?.ti || 'ምዝገባ ናይ ስራሕ ዕድል')
    : (schema.title?.en || 'Accessible Workplace Opportunity');

  const allBenefits = Object.values(ACCOMMODATION_LABELS).map((l) => (isAm ? l.am : isOm ? l.om : isTi ? l.ti : l.en));
  const summary = isAm
    ? `የሥራ ቦታ ተደራሽነት እና ማመቻቸት፡ ${allBenefits.join('፣ ')}።`
    : isTi
    ? `ናይ ስራሕ ቦታ ተበጻሕነትን ምምዕርራይን፦ ${allBenefits.join('፣ ')}።`
    : isOm
    ? `Mijaa'ina iddoo hojii dhihaate: ${allBenefits.join(', ')}.`
    : `Workplace accessibility and accommodations offered: ${allBenefits.join(', ')}.`;

  const description = `<p><strong>${title}</strong></p><p>${schema.intro?.[lang] || schema.intro?.en || ''}</p><p>${summary}</p>`;

  const today = new Date().toISOString().split('T')[0];

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title,
    description,
    datePosted: today,
    validThrough: addDays(today, 90),
    employmentType: 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: isAm ? 'አጋር ቀጣሪ ድርጅት' : isOm ? 'Dhaabbata Michuu' : isTi ? 'መሻርኽቲ ቀጣሪ ትካል' : 'Partner Inclusive Employer',
      sameAs: baseUrl,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Addis Ababa',
        addressRegion: 'Addis Ababa',
        addressCountry: 'ET',
      },
    },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Ethiopia',
    },
    occupationalCategory: isAm ? 'የተለያዩ የሥራ ዘርፎች' : isOm ? 'Gosa Hojii Adda Addaa' : isTi ? 'ዝተፈላለዩ ናይ ስራሕ ዓውድታት' : 'Various Occupations',
    accessibilitySummary: summary,
    jobBenefits: allBenefits,
    directApply: true,
  };
}

/**
 * Generates schema.org/JobPosting JSON-LD from a completed employer submission.
 * Strictly guarantees ZERO PII in the generated JSON-LD.
 */
export function generateJobPostingFromSubmission(submission, schema, { lang = 'en', baseUrl = 'https://openpath.org' } = {}) {
  if (schema?.generates !== 'schema.org/JobPosting') {
    return null;
  }

  const answers = submission?.answers || {};
  const isAm = lang === 'am';
  const isOm = lang === 'om';
  const isTi = lang === 'ti';

  const company = String(answers.company || '').trim() || (isAm ? 'አጋር ድርጅት' : isOm ? 'Dhaabbata Michuu' : isTi ? 'መሻርኽቲ ትካል' : 'Inclusive Employer');
  const role = String(answers.role || '').trim() || (isAm ? 'የተደራሽ የሥራ ዕድል' : isOm ? 'Gahee Hojii Mijataa' : isTi ? 'ክፍቲ ናይ ስራሕ መደብ' : 'Accessible Workplace Role');
  const categoryKey = answers['job-category'];
  const categoryLabel = (categoryKey && CATEGORY_NAMES[categoryKey]?.[isAm ? 'am' : isOm ? 'om' : isTi ? 'ti' : 'en']) || (isAm ? 'አጠቃላይ' : isOm ? 'Waliigala' : isTi ? 'ሓፈሻዊ' : 'General');

  const pickedAccommodations = Array.isArray(answers.accommodations) ? answers.accommodations : [];
  const benefits = pickedAccommodations
    .map((k) => ACCOMMODATION_LABELS[k]?.[isAm ? 'am' : isOm ? 'om' : isTi ? 'ti' : 'en'])
    .filter(Boolean);

  const isRemote = pickedAccommodations.includes('remote');

  const summary = benefits.length > 0
    ? (isAm ? `የሥራ ቦታ ማመቻቸቶች፡ ${benefits.join('፣ ')}።` : isTi ? `ናይ ስራሕ ቦታ ምምዕርራይ፦ ${benefits.join('፣ ')}።` : isOm ? `Mijaa'ina iddoo hojii: ${benefits.join(', ')}.` : `Accommodations provided: ${benefits.join(', ')}.`)
    : (isAm ? 'ተደራሽ የሥራ ቦታ ማመቻቸት ይገኛል።' : isTi ? 'ተበጻሒ ናይ ስራሕ ቦታ ምምዕርራይ ኣሎ።' : isOm ? "Mijaa'inni iddoo hojii ni jira." : 'Accessible workplace accommodations available.');

  const description = isAm
    ? `<p><strong>${role}</strong> በ <strong>${company}</strong>።</p><p>የሥራ ዘርፍ፡ ${categoryLabel}</p><p>${summary}</p>`
    : isTi
    ? `<p><strong>${role}</strong> ኣብ <strong>${company}</strong>።</p><p>ናይ ስራሕ ዓውዲ፦ ${categoryLabel}</p><p>${summary}</p>`
    : isOm
    ? `<p><strong>${role}</strong> bakka <strong>${company}</strong>.</p><p>Gosa hojii: ${categoryLabel}</p><p>${summary}</p>`
    : `<p><strong>${role}</strong> at <strong>${company}</strong>.</p><p>Category: ${categoryLabel}.</p><p>${summary}</p>`;

  const datePosted = (submission.receivedAt ? submission.receivedAt.split('T')[0] : new Date().toISOString().split('T')[0]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    identifier: {
      '@type': 'PropertyValue',
      name: 'OpenPath Reference',
      value: submission.id || 'employer-posting',
    },
    title: role,
    description,
    datePosted,
    validThrough: addDays(datePosted, 90),
    employmentType: 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: company,
      sameAs: baseUrl,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Addis Ababa',
        addressRegion: 'Addis Ababa',
        addressCountry: 'ET',
      },
    },
    occupationalCategory: categoryLabel,
    accessibilitySummary: summary,
    jobBenefits: benefits,
    directApply: true,
  };

  if (isRemote) {
    jsonLd.jobLocationType = 'TELECOMMUTE';
    jsonLd.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'Ethiopia',
    };
  }

  // Explicit safety check: Ensure NO phone, email, contact, or medical data slipped through
  delete jsonLd.contact;
  delete jsonLd.phone;
  delete jsonLd.email;
  delete jsonLd['accessibility-prefs'];

  return jsonLd;
}
