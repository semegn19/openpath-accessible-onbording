import type { Lang, LText } from './types';
import { SOMALI_TRANSLATIONS } from './locales/somali';

export const t = (v: LText | undefined, lang: Lang, fallback = ''): string => {
  if (!v) return fallback;
  if (lang === 'so') {
    if (v.so) return v.so;
    const en = v.en;
    if (en) {
      if (SOMALI_TRANSLATIONS[en]) return SOMALI_TRANSLATIONS[en];
      const trimmed = en.trim();
      if (SOMALI_TRANSLATIONS[trimmed]) return SOMALI_TRANSLATIONS[trimmed];
    }
  }
  return v[lang] || v.en || fallback;
};

export const tpl = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

/** One message builder for every error, so a placeholder can never reach the screen again. */
export const errorText = (
  errors: Record<string, LText> | undefined,
  lang: Lang,
  failure: { rule: string; params?: Record<string, string | number> } | undefined,
): string => {
  if (!failure) return '';
  const raw = t(errors?.[failure.rule], lang, failure.rule);
  return failure.params ? tpl(raw, failure.params) : raw;
};
