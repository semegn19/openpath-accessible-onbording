import raw from './schemas/runtime-copy-v1.json';
import { t } from './i18n';
import type { Lang, LText } from './types';

/**
 * Copy the app prints about itself: send status, connectivity, the microphone's error messages,
 * the Ethiopian date field's labels.
 *
 * It lives in `schema/runtime-copy-v1.json` rather than in a form's `ui` block because it is
 * shared by all three forms and is not a question. One file means one place for a copy reviewer to
 * read, one `npm run validate` pass for missing languages and mismatched `{placeholders}`, and one
 * entry in `tests/copy-source.mjs` that fails if a key is used but undeclared, or declared but
 * unused.
 *
 * A missing key renders as the key itself. A visible `status.sending` is a defect someone reports;
 * a blank button is one nobody notices.
 */
const strings = (raw as unknown as { strings: Record<string, LText> }).strings;

const SO_RUNTIME_COPY: Record<string, string> = {
  'settings.language': 'Dooro luqaddaada',
  'settings.big': 'Qoraal weyn',
  'settings.simple': 'Erayo fudud',
  'settings.autoRead': 'Si toos ah u akhri',
  'settings.group': 'Habaynta akhriska',
  'settings.help': 'Caawin',
  'status.saved': 'Jawaabahaagii waa la kaydiyay.',
  'status.sending': 'Waa la dirayaa...',
  'status.complete': 'Diiwaangelintii waa dhammaatay.',
  'status.wait': 'Fadlan sug...',
  'status.thanks': 'Waad ku mahadsan tahay.',
  'jobFilter.title': 'Shaandheeyaha taageerada goobta shaqada',
  'jobFilter.toggle': 'Raadi shaqooyin ku habboon taageerada aad u baahan tahay',
  'jobFilter.matchesCount': '{count} shaqooyin oo ku habboon ayaa la helay',
  'jobFilter.applyForThis': 'Dalbo shaqadan',
  'jobFilter.nextToRegister': 'U gudub diiwaangelinta',
  'jobFilter.clear': 'Nadiifi shaandheeyaha',
  'jobFilter.all': 'Tus dhammaan shaqooyinka',
  'jobFilter.noMatches': 'Lama helin shaqooyin u dhigma xulashadaada.',
  'jobFilter.privacy': 'Doorashooyinkaagu waxay ku hadhayaan qalabkaaga oo kaliya; looma sheegayo loo-shaqeeyaha.',
  'jobFilter.applyingFor': 'Waxaad u dalbanaysaa:',
  'jobFilter.backToListings': 'Ku noqo liiska shaqooyinka',
  'review.intro': 'Eeg macluumaadkaaga',
  'review.nextHint': 'Guji si aad wax uga beddesho su’aal kasta.',
  'nav.skip': 'U gudub nuxurka muhiimka ah',
  'banner.dismiss': 'Xidh',
};

export const c = (key: string, lang: Lang): string => {
  if (lang === 'so' && SO_RUNTIME_COPY[key]) return SO_RUNTIME_COPY[key];
  return strings[key] ? t(strings[key], lang) : key;
};

/** Used by tests: every declared key, so the check can look for an unused one. */
export const copyKeys = Object.keys(strings);
