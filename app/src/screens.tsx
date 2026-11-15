import { c } from './copy';
import { forwardRef } from 'react';
import type { Lang, Schema, Step, Values } from './types';
import { t, errorText } from './i18n';
import { Icon } from './icons';
import { questionText, optionText } from './fields';

export const ErrorSummary = forwardRef<HTMLDivElement, {
  items: { step: Step; rule: { rule: string; params?: Record<string, string | number> } }[];
  lang: Lang;
  schema: Schema;
  onJump: (id: string) => void;
}>(({ items, lang, schema, onJump }, ref) => {
  if (!items.length) return null;
  return (
    <div className="op-error-summary" ref={ref} tabIndex={-1} role="alert" aria-labelledby="op-error-title op-error-list">
      <h2 id="op-error-title" className="op-error-title">
        {t(schema.ui?.errorSummary, lang)}
      </h2>
      <ul id="op-error-list">
        {items.map(({ step, rule }) => (
          <li key={step.id}>
            <a href={`#${step.id}`} onClick={(e) => { e.preventDefault(); onJump(step.id); }}>
              {questionText(step, lang, false)}: {errorText(schema.errors, lang, rule)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});

/** One answer, as a person reads it. Exported so the review screen can be *heard* as well as
 *  seen — the same string feeds the read-aloud button and the visible row. */
export function answerText(s: Step, values: Values, lang: Lang, simple = false): string {
  const v = values[s.id];
  if (Array.isArray(v)) {
    return v.map((x) => {
      const o = (s.options ?? []).find((y) => y.value === x);
      return o ? optionText(o, lang, simple) : String(x);
    }).join(', ');
  }
  if (typeof v === 'string') {
    const opt = (s.options ?? []).find((o) => o.value === v);
    return opt ? optionText(opt, lang, simple) : v;
  }
  if (s.type === 'date-ec-gc' && v && typeof v === 'object') {
    const d = v as { year?: string; month?: string; day?: string; yearOnly?: boolean };
    return [d.year, d.month, d.day].filter(Boolean).join('/') + (d.yearOnly ? (c('date.yearOnlyShort', lang)) : '');
  }
  if (s.type === 'file' && v && typeof v === 'object') {
    return (v as { name?: string }).name ?? '';
  }
  return String(v ?? '');
}

/** The whole review, as one spoken paragraph: question, answer, question, answer. */
export function reviewText(steps: Step[], values: Values, lang: Lang, simple: boolean, intro: string, outro: string): string {
  const answered = steps.filter((s) => !['review', 'submit'].includes(s.type) && values[s.id] !== undefined);
  const parts = [intro];
  for (const s of answered) parts.push(`${questionText(s, lang, simple)} ${answerText(s, values, lang, simple)}.`);
  parts.push(outro);
  return parts.join(' ');
}

export function ReviewScreen({ steps, values, lang, simple, schema, onEdit }: {
  steps: Step[]; values: Values; lang: Lang; simple?: boolean; schema: Schema; onEdit: (id: string) => void;
}) {
  const answered = steps.filter((s) => s.type !== 'review' && s.type !== 'submit' && values[s.id] !== undefined);
  const render = (s: Step): string => answerText(s, values, lang, Boolean(simple));
  return (
    <dl className="op-review">
      {answered.map((s) => (
        <div key={s.id} className="op-review-row">
          <dt>{questionText(s, lang, Boolean(simple))}</dt>
          <dd>
            <span>{render(s)}</span>
            <button type="button" className="op-btn op-btn-link" onClick={() => onEdit(s.id)}>
              {t(schema.ui?.edit, lang)}
              <span className="op-sr"> — {questionText(s, lang, Boolean(simple))}</span>
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const LANG_CHIPS: { id: Lang; label: string }[] = [{ id: 'am', label: 'አማርኛ' }, { id: 'om', label: 'Afaan Oromoo' }, { id: 'ti', label: 'ትግርኛ' }, { id: 'so', label: 'Soomaali' }, { id: 'en', label: 'English' }];

export function SettingsBar({ lang, setLang, simple, setSimple, big, setBig, autoRead, setAutoRead }: {
  lang: Lang; setLang: (l: Lang) => void;
  simple: boolean; setSimple: (b: boolean) => void;
  big: boolean; setBig: (b: boolean) => void;
  autoRead: boolean; setAutoRead: (b: boolean) => void;
}) {
  return (
    <div className="op-settings" role="group" aria-label={c('settings.group', lang)}>
      <div className="op-lang" role="group" aria-label={c('settings.language', lang)}>
        {LANG_CHIPS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="op-btn op-btn-chip"
            aria-pressed={lang === id}
            onClick={() => setLang(id)}
            lang={id}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Toggle buttons, not checkbox rows: as three stacked 52 px rows this bar ate 287 px of
          a 400 px viewport and covered the question it was supposed to help with. */}
      <div className="op-toggles" role="group" aria-label={c('settings.help', lang)}>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={simple} onClick={() => setSimple(!simple)}>
          <Icon name="simple" />{c('settings.simple', lang)}
        </button>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={big} onClick={() => setBig(!big)}>
          <Icon name="text-large" />{c('settings.big', lang)}
        </button>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={autoRead} onClick={() => setAutoRead(!autoRead)}>
          <Icon name="speaker" />{c('settings.autoRead', lang)}
        </button>
      </div>
    </div>
  );
}
