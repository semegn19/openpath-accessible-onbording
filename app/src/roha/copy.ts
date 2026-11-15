import copy from '../schemas/roha-copy-v1.json';
import { OM_COPY, TI_COPY } from './locales/om-ti';
import { SO_COPY } from './locales/so';

export type RohaCopyKey = keyof typeof copy.strings;

export function rc(key: RohaCopyKey, locale: string, values: Record<string, string | number> = {}): string {
  const lang = locale.toLowerCase().split('-')[0];
  let template = '';
  const entry = (copy.strings[key] || {}) as Record<string, string>;

  if (lang === 'om') {
    template = OM_COPY[key] || entry['om'] || entry['en'] || '';
  } else if (lang === 'ti') {
    template = TI_COPY[key] || entry['ti'] || entry['en'] || '';
  } else if (lang === 'so') {
    template = SO_COPY[key] || entry['so'] || entry['en'] || '';
  } else if (lang === 'en') {
    template = entry['en'] || '';
  } else {
    template = entry[lang] || entry['am'] || entry['en'] || '';
  }

  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`Missing copy parameter: ${key}.${name}`);
    return String(values[name]);
  });
}
