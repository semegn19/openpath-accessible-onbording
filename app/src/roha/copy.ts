import copy from '../schemas/roha-copy-v1.json';
export type RohaCopyKey = keyof typeof copy.strings;
export function rc(key: RohaCopyKey, locale: string, values: Record<string, string | number> = {}): string {
  const template = copy.strings[key][locale.toLowerCase().split('-')[0] === 'am' ? 'am' : 'en'];
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`Missing copy parameter: ${key}.${name}`);
    return String(values[name]);
  });
}
