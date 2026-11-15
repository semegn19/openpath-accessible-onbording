import copy from '../schemas/roha-copy-v1.json';
import { OM_COPY, TI_COPY } from './locales/om-ti';

export type RohaCopyKey = keyof typeof copy.strings;

export function rc(key: RohaCopyKey, locale: string, values: Record<string, string | number> = {}): string {
  const lang = locale.toLowerCase().split('-')[0];
  let template = '';

  if (lang === 'om' && OM_COPY[key]) {
    template = OM_COPY[key];
  } else if (lang === 'ti' && TI_COPY[key]) {
    template = TI_COPY[key];
  } else {
    const entry = copy.strings[key] as Record<string, string>;
    template = entry[lang] || entry['am'] || entry['en'] || '';
  }

  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`Missing copy parameter: ${key}.${name}`);
    return String(values[name]);
  });
}
