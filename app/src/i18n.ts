import type { Lang, LText } from './types';

export const t = (v: LText | undefined, lang: Lang, fallback = ''): string =>
  v ? (v[lang] || v.en || fallback) : fallback;

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
