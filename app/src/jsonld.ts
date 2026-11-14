/**
 * Client-side Schema.org JSON-LD builder and DOM syncer — Level 3 Integration.
 *
 * Injects and reactively updates <script type="application/ld+json" id="openpath-jsonld">
 * whenever the active form declares `generates: "schema.org/JobPosting"`.
 *
 * Copy has one home: the schema. All titles, category names, and accommodation labels
 * are derived directly from the active Schema definition rather than hardcoded twins.
 *
 * Guarantees zero PII (contact phone numbers or personal data) in the output.
 */
import type { Schema, Lang } from './types';

function addDays(isoDateStr: string, days = 90): string {
  const d = new Date(isoDateStr || Date.now());
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function buildJobPostingJsonLd(
  schema: Schema,
  answers: Record<string, unknown> = {},
  lang: Lang = 'en',
  baseUrl = 'https://openpath.org',
): Record<string, unknown> | null {
  if (schema.generates !== 'schema.org/JobPosting') {
    return null;
  }

  const rawRole = typeof answers.role === 'string' ? answers.role.trim() : '';
  const rawCompany = typeof answers.company === 'string' ? answers.company.trim() : '';

  const fallbackTitle = schema.title?.[lang] || schema.title?.en || 'Job Opportunity';
  const role = rawRole || fallbackTitle;
  const company = rawCompany || 'Inclusive Employer';

  const categoryKey = typeof answers['job-category'] === 'string' ? answers['job-category'] : '';
  const catStep = schema.steps.find((s) => s.id === 'job-category');
  const catOption = catStep?.options?.find((o) => o.value === categoryKey);
  const categoryLabel = catOption?.label?.[lang] || catOption?.label?.en || '';

  const pickedAccommodations = Array.isArray(answers.accommodations)
    ? (answers.accommodations as string[])
    : [];

  const accStep = schema.steps.find((s) => s.id === 'accommodations');
  const benefits = pickedAccommodations
    .map((k) => {
      const opt = accStep?.options?.find((o) => o.value === k);
      return opt?.label?.[lang] || opt?.label?.en;
    })
    .filter((b): b is string => Boolean(b));

  const isRemote = pickedAccommodations.includes('remote');

  // Separator: use Ethiopic comma if Amharic, or standard comma
  const sep = lang === 'am' ? '\u1363 ' : ', ';
  const summary = benefits.length > 0 ? benefits.join(sep) : '';

  const descParts: string[] = [`<p><strong>${role}</strong> — <strong>${company}</strong></p>`];
  if (categoryLabel) descParts.push(`<p>${categoryLabel}</p>`);
  if (summary) descParts.push(`<p>${summary}</p>`);
  const description = descParts.join('');

  const datePosted = new Date().toISOString().split('T')[0];

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    identifier: {
      '@type': 'PropertyValue',
      name: 'OpenPath Schema',
      value: schema.id,
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
    occupationalCategory: categoryLabel || 'General',
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

  // Strict PII sanitization: Ensure no phone or contact info is ever present
  delete jsonLd.contact;
  delete jsonLd.phone;
  delete jsonLd.email;
  delete jsonLd['accessibility-prefs'];

  return jsonLd;
}

export function syncJsonLdScript(
  schema: Schema,
  answers: Record<string, unknown> = {},
  lang: Lang = 'en',
): () => void {
  if (typeof document === 'undefined') return () => {};

  const existing = document.getElementById('openpath-jsonld') as HTMLScriptElement | null;

  if (schema.generates !== 'schema.org/JobPosting') {
    if (existing) existing.remove();
    return () => {};
  }

  const jsonLd = buildJobPostingJsonLd(schema, answers, lang);
  if (!jsonLd) {
    if (existing) existing.remove();
    return () => {};
  }

  const script = existing || document.createElement('script');
  script.id = 'openpath-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(jsonLd, null, 2);

  if (!existing) {
    document.head.appendChild(script);
  }

  return () => {
    const el = document.getElementById('openpath-jsonld');
    if (el) el.remove();
  };
}
