import type { Rule, Step } from './types';

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

/** Returns the failing rule name, or null. The message comes from schema.errors. */
export function firstFailure(step: Step, value: unknown): string | null {
  const rules: Rule[] = step.validation ?? [];
  for (const r of rules) {
    switch (r.rule) {
      case 'required':
        if (step.type === 'submit' || step.type === 'statement') {
          const requiredOptions = (step.options ?? []).filter((o) => o.required).map((o) => o.value);
          if (requiredOptions.length && !requiredOptions.every((v) => (value as string[] | undefined)?.includes?.(v)))
            return 'required';
        } else if (isEmpty(value)) return 'required';
        break;
      case 'phone-et':
        if (!isEmpty(value) && !normalizePhoneET(String(value))) return 'phone-et';
        break;
      case 'email':
        if (!isEmpty(value) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())) return 'email';
        break;
      case 'minLength':
        if (!isEmpty(value) && String(value).trim().length < (r.value ?? 1)) return 'minLength';
        break;
      case 'maxLength':
        if (!isEmpty(value) && String(value).trim().length > (r.value ?? Infinity)) return 'maxLength';
        break;
      case 'minValue':
        if (num(value) !== null && (num(value) as number) < (r.value ?? -Infinity)) return 'minValue';
        break;
      case 'maxValue':
        if (num(value) !== null && (num(value) as number) > (r.value ?? Infinity)) return 'maxValue';
        break;
      case 'exclusiveOption': {
        const arr = value as string[] | undefined;
        const exclusive = (step.options ?? []).find((o) => o.exclusive)?.value;
        if (arr && exclusive && arr.includes(exclusive) && arr.length > 1) return 'exclusiveOption';
        break;
      }
      default:
        break;
    }
  }
  return null;
}
