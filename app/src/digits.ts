/**
 * Spoken digits → digits.
 *
 * Amharic speech recognition returns words ("ዘጠኝ አንድ አንድ") where a phone field
 * needs "911". English does the same ("zero nine one one"). Citizens read phone
 * numbers digit by digit and read amounts as words, so both forms show up.
 *
 * Rules, in order:
 *  1. Every token is a single digit (word or numeral) → join them: 911, 0912345678.
 *  2. Every token is a number word → compose as a number: "ሁለት መቶ ሰላሳ" → 230.
 *  3. Anything we do not understand → return the input untouched.
 *     Never guess at a phone number.
 */

import type { Lang } from './types';

const AM: Record<string, number> = {
  'ዜሮ': 0, 'ዘሮ': 0, 'ዚሮ': 0,
  'አንድ': 1, 'አንዳንድ': 1, 'ሓደ': 1,
  'ሁለት': 2, 'ሁለቱ': 2, 'ክልተ': 2,
  'ሶስት': 3, 'ሦስት': 3, 'ሶስቱ': 3, 'ሰለስተ': 3,
  'አራት': 4, 'አራቱ': 4, 'ኣርባዕተ': 4,
  'አምስት': 5, 'አምስቱ': 5, 'ሓሙሽተ': 5,
  'ስድስት': 6, 'ስድስቱ': 6, 'ሽድሽተ': 6,
  'ሰባት': 7, 'ሰባቱ': 7, 'ሸውዓተ': 7,
  'ስምንት': 8, 'ስምንቱ': 8, 'ሸሞንተ': 8,
  'ዘጠኝ': 9, 'ዘጠኙ': 9, 'ትሽዓተ': 9,
  'አስር': 10, 'አስራ': 10, 'ዓሰርተ': 10,
  'አስራ አንድ': 11, 'አስራ ሁለት': 12, 'አስራ ሶስት': 13, 'አስራ አራት': 14, 'ዓሰርተ ሓደ': 11, 'ዓሰርተ ክልተ': 12, 'ዓሰርተ ሰለስተ': 13, 'ዓሰርተ ኣርባዕተ': 14,
  'አስራ አምስት': 15, 'አስራ ስድስት': 16, 'አስራ ሰባት': 17, 'አስራ ስምንት': 18, 'አስራ ዘጠኝ': 19, 'ዓሰርተ ሓሙሽተ': 15, 'ዓሰርተ ሽድሽተ': 16, 'ዓሰርተ ሸውዓተ': 17, 'ዓሰርተ ሸሞንተ': 18, 'ዓሰርተ ትሽዓተ': 19,
  'ሃያ': 20, 'ሀያ': 20, 'ሃያ አንድ': 21, 'ዕስራ': 20, 'ዕስራን ሓደን': 21,
  'ሰላሳ': 30, 'ሠላሳ': 30, 'ሰላሳ አንድ': 31, 'ሰላሳን ሓደን': 31,
  'አርባ': 40, 'አርባ አንድ': 41, 'ኣርብዓ': 40, 'ኣርብዓን ሓደን': 41,
  'ሃምሳ': 50, 'ሀምሳ': 50, 'ሓምሳ': 50,
  'ስልሳ': 60, 'ስድሳ': 60, 'ስሳ': 60,
  'ሰባ': 70, 'ሰብዓ': 70,
  'ሰማንያ': 80,
  'ዘጠና': 90, 'ተስዓ': 90,
  'መቶ': 100, 'ሚእቲ': 100,
  'ሺህ': 1000, 'ሺ': 1000, 'ሽሕ': 1000,
};

const EN: Record<string, number> = {
  zero: 0, oh: 0, nought: 0, o: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100, thousand: 1000,
};

const OM: Record<string, number> = {
  zeeroo: 0, duudaa: 0,
  tokko: 1, tokkicha: 1,
  lama: 2, lachanuu: 2,
  sadii: 3, sadi: 3,
  afur: 4,
  shan: 5,
  "ja'a": 6, jaa: 6, jaha: 6,
  torba: 7,
  saddeet: 8, sadet: 8,
  sagal: 9,
  kudhan: 10, kurna: 10,
  kudhatokko: 11, kudhalama: 12, kudhasadii: 13, kudhafur: 14,
  kudhashan: 15, "kudhaja'a": 16, kudhatorba: 17, kudhasaddeet: 18, kudhasagal: 19,
  digdama: 20, soddoma: 30, afurtama: 40, shantama: 50, jaatama: 60,
  torbaatama: 70, saddeettama: 80, sagaltama: 90,
  dhibba: 100, kuma: 1000,
};

const SO: Record<string, number> = {
  eber: 0, eberka: 0, zero: 0,
  kow: 1, koow: 1,
  laba: 2,
  saddex: 3, seddex: 3,
  afar: 4,
  shan: 5,
  lix: 6,
  toddobo: 7, todobo: 7,
  siddeed: 8, sideed: 8,
  sagaal: 9,
  toban: 10,
  labaatan: 20, soddon: 30, afartan: 40, konton: 50, lixdan: 60,
  toddobaatan: 70, siddeetan: 80, sagaashan: 90,
  boqol: 100, kun: 1000,
};

const tokenise = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[።፣፤፥?.,!;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

export function spokenToDigits(text: string, lang: Lang): string {
  const raw = text.trim();
  if (!raw) return raw;

  const words = (lang === 'am' || lang === 'ti') ? AM : lang === 'om' ? OM : lang === 'so' ? SO : EN;
  const tokens = tokenise(raw);
  if (!tokens.length) return raw;

  // A token is either a numeral the ASR already produced, or a word we know.
  const values: Array<number | null> = tokens.map((tk) => {
    if (/^\d+$/.test(tk)) return Number(tk);
    if (tk in words) return words[tk];
    // "አስራ ሁለት" style pairs are joined before lookup
    return null;
  });

  if (values.some((v) => v === null)) {
    // Try the two-token join for 11–99 in Amharic ("አስራ" + "ሁለት")
    const merged: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const pair = `${tokens[i]} ${tokens[i + 1] ?? ''}`.trim();
      if (pair in words) { merged.push(words[pair]); i++; continue; }
      const single = values[i];
      if (single === null) return raw; // unknown word → do not guess
      merged.push(single);
    }
    return render(merged, tokens);
  }
  return render(values as number[], tokens);
}

function render(values: number[], tokens: string[]): string {
  // Rule 1: every token is a single digit (word or numeral) → join digit by digit.
  // Numeral tokens keep their raw text, so "09 11 23" stays "091123" and not 9+11+23.
  const digitish = tokens.every((tk, i) => /^\d+$/.test(tk) || (values[i] !== null && (values[i] as number) <= 9));
  if (digitish) {
    return tokens.map((tk, i) => (/^\d+$/.test(tk) ? tk : String(values[i]))).join('');
  }

  // Rule 2: compose a number. "ሁለት መቶ ሰላሳ አምስት" → 235, "ሁለት ሺህ" → 2000.
  let total = 0;
  let current = 0;
  for (const v of values) {
    if (v === 100) current = (current || 1) * 100;
    else if (v === 1000) { total += (current || 1) * 1000; current = 0; }
    else current += v;
  }
  return String(total + current);
}

/** True when the transcript already looks like the value we want, so the UI can stay quiet. */
export const isAlreadyDigits = (text: string): boolean => /^[+\d][\d\s-]*$/.test(text.trim());
