export type Lang = 'am' | 'en' | 'om' | 'ti' | 'so';
export type LText = Partial<Record<Lang, string>> & { en: string };

export type FieldType =
  | 'text' | 'tel' | 'email' | 'number' | 'textarea' | 'select'
  | 'radio' | 'checkbox' | 'file' | 'date-ec-gc' | 'language'
  | 'statement' | 'review' | 'submit';

export interface Option {
  value: string;
  label: LText;
  /**
   * SC 3.1.2 Language of Parts: set this when the label is written in a language other than the
   * one the page is currently showing — e.g. the word "English" inside the Amharic form. Without
   * it a screen reader reads that word with the Amharic voice, at the exact moment the person is
   * trying to leave Amharic.
   */
  lang?: string;
  icon?: string;
  /** Label when simple words are on. */
  simple?: LText;
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
  /** Heading, hint, why and body each have a simple-words form. */
  simple?: LText;
  simpleHint?: LText;
  simpleWhy?: LText;
  simpleBody?: LText;
  hint?: LText;
  why?: LText;
  body?: LText;
  icon?: string;
  required?: boolean;
  optional?: boolean;
  voice?: boolean;
  readAloud?: boolean;
  audio?: Partial<Record<Lang, string>>;
  pii?: 'none' | 'personal' | 'sensitive';
  localOnly?: boolean;
  inputmode?: string;
  /** HTML autocomplete token (SC 1.3.5). Absent = "off" — right for an ID number. */
  autocomplete?: string;
  accept?: string;
  /** One condition, or several that must all hold. */
  showIf?: { step: string; in: string[] } | Array<{ step: string; in: string[] }>;
  validation?: Rule[];
  options?: Option[];
  submitLabel?: LText;
}

export interface Schema {
  id: string;
  version: string;
  kind?: string;
  generates?: string;
  defaultLang: Lang;
  langs: Lang[];
  calendar?: string;
  title: LText;
  intro?: LText;
  /** Shown instead of `intro` when simple words are on. */
  introSimple?: LText;
  steps: Step[];
  errors: Record<string, LText>;
  ui?: Record<string, LText>;
}

export type Values = Record<string, unknown>;
export type Errors = Record<string, import('./validation').Failure>;
