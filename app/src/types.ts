export type Lang = 'am' | 'en';
export type LText = Partial<Record<Lang, string>> & { en: string };

export type FieldType =
  | 'text' | 'tel' | 'email' | 'number' | 'textarea' | 'select'
  | 'radio' | 'checkbox' | 'file' | 'date-ec-gc' | 'language'
  | 'statement' | 'review' | 'submit';

export interface Option {
  value: string;
  label: LText;
  icon?: string;
  exclusive?: boolean;
  applies?: string;
  required?: boolean;
}
export interface Rule { rule: string; value?: number; option?: string }

export interface Step {
  id: string;
  type: FieldType;
  label?: LText;
  legend?: LText;
  simple?: LText;
  hint?: LText;
  why?: LText;
  body?: LText;
  icon?: string;
  required?: boolean;
  optional?: boolean;
  voice?: boolean;
  readAloud?: boolean;
  pii?: 'none' | 'personal' | 'sensitive';
  localOnly?: boolean;
  inputmode?: string;
  /** HTML autocomplete token (SC 1.3.5). Absent = "off" — right for an ID number. */
  autocomplete?: string;
  accept?: string;
  showIf?: { step: string; in: string[] };
  validation?: Rule[];
  options?: Option[];
  submitLabel?: LText;
}

export interface Schema {
  id: string;
  version: string;
  kind?: string;
  defaultLang: Lang;
  langs: Lang[];
  calendar?: string;
  title: LText;
  intro?: LText;
  steps: Step[];
  errors: Record<string, LText>;
  ui?: Record<string, LText>;
}

export type Values = Record<string, unknown>;
export type Errors = Record<string, string>;
