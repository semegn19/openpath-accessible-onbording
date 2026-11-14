import type { Rule, Step } from './types';

/** A failed rule, plus the numbers the message needs. Returning only the rule name is what left
 *  "{n}" printed literally in the interface: the message had no value to interpolate. */
export type Failure = { rule: string; params?: Record<string, string | number> };

/** Ethiopian mobile numbers: 09…/07…, +251…, 251…, spaces and dashes allowed. */
export function normalizePhoneET(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '');
  if (/^\+251[79]\d{8}$/.test(digits)) return digits;
  if (/^251[79]\d{8}$/.test(digits)) return '+' + digits;
  if (/^0[79]\d{8}$/.test(digits)) return '+251' + digits.slice(1);
  if (/^[79]\d{8}$/.test(digits)) return '+251' + digits;
  return null;
}

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const num = (v: unknown): number | null => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Returns the failing rule and its parameters, or null. The wording comes from schema.errors. */
export function firstFailure(step: Step, value: unknown): Failure | null {
  const rules: Rule[] = step.validation ?? [];
  for (const r of rules) {
    switch (r.rule) {
      case 'required':
        if (step.type === 'submit' || step.type === 'statement') {
          const requiredOptions = (step.options ?? []).filter((o) => o.required).map((o) => o.value);
          if (requiredOptions.length && !requiredOptions.every((v) => (value as string[] | undefined)?.includes?.(v)))
            return { rule: 'required' };
        } else if (isEmpty(value)) return { rule: 'required' };
        break;
      case 'phone-et':
        if (!isEmpty(value) && !normalizePhoneET(String(value))) return { rule: 'phone-et' };
        break;
      case 'email':
        if (!isEmpty(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())) return { rule: 'email' };
        break;
      case 'minLength':
        if (!isEmpty(value) && String(value).trim().length < (r.value ?? 1)) {
          return { rule: 'minLength', params: { n: r.value ?? 1 } };
        }
        break;
      case 'maxLength':
        if (!isEmpty(value) && String(value).trim().length > (r.value ?? Infinity)) {
          return { rule: 'maxLength', params: { n: r.value ?? '' } };
        }
        break;
      case 'minValue':
        if (num(value) !== null && (num(value) as number) < (r.value ?? -Infinity)) {
          return { rule: 'minValue', params: { n: r.value ?? 0 } };
        }
        break;
      case 'maxValue':
        if (num(value) !== null && (num(value) as number) > (r.value ?? Infinity)) {
          return { rule: 'maxValue', params: { n: r.value ?? 0 } };
        }
        break;
      case 'exclusiveOption': {
        const arr = value as string[] | undefined;
        const exclusive = (step.options ?? []).find((o) => o.exclusive)?.value;
        if (arr && exclusive && arr.includes(exclusive) && arr.length > 1) return { rule: 'exclusiveOption' };
        break;
      }
      default:
        break;
    }
  }
  return null;
}
