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

export const c = (key: string, lang: Lang): string => (strings[key] ? t(strings[key], lang) : key);

/** Used by tests: every declared key, so the check can look for an unused one. */
export const copyKeys = Object.keys(strings);
