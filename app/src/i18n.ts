import type { Lang, LText } from './types';

export const t = (v: LText | undefined, lang: Lang, fallback = ''): string =>
  v ? (v[lang] || v.en || fallback) : fallback;

export const tpl = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
