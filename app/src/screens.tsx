import { forwardRef } from 'react';
import type { Lang, Schema, Step, Values } from './types';
import { t } from './i18n';
import { Icon } from './icons';
import { questionText } from './fields';

export const ErrorSummary = forwardRef<HTMLDivElement, {
  items: { step: Step; rule: string }[];
  lang: Lang;
  schema: Schema;
  onJump: (id: string) => void;
}>(({ items, lang, schema, onJump }, ref) => {
  if (!items.length) return null;
  return (
    <div className="op-error-summary" ref={ref} tabIndex={-1} role="alert" aria-labelledby="op-error-title">
      <h2 id="op-error-title" className="op-error-title">
        {t(schema.ui?.errorSummary, lang, lang === 'am' ? 'እባክዎ እነዚህን ያስተካክሉ' : 'Please fix these')}
      </h2>
      <ul>
        {items.map(({ step, rule }) => (
          <li key={step.id}>
            <a href={`#${step.id}`} onClick={(e) => { e.preventDefault(); onJump(step.id); }}>
              {questionText(step, lang, false)}: {t(schema.errors[rule], lang, rule)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});

export function ReviewScreen({ steps, values, lang, schema, onEdit }: {
  steps: Step[]; values: Values; lang: Lang; schema: Schema; onEdit: (id: string) => void;
}) {
  const answered = steps.filter((s) => s.type !== 'review' && s.type !== 'submit' && values[s.id] !== undefined);
  const render = (s: Step): string => {
    const v = values[s.id];
    if (Array.isArray(v)) return v.map((x) => t((s.options ?? []).find((o) => o.value === x)?.label, lang, String(x))).join(', ');
    if (typeof v === 'string') {
      const opt = (s.options ?? []).find((o) => o.value === v);
      return opt ? t(opt.label, lang) : v;
    }
    if (s.type === 'date-ec-gc' && v && typeof v === 'object') {
      const d = v as { year?: string; month?: string; day?: string; yearOnly?: boolean };
      return [d.year, d.month, d.day].filter(Boolean).join('/') + (d.yearOnly ? (lang === 'am' ? ' (ዓመት ብቻ)' : ' (year only)') : '');
    }
    return String(v ?? '');
  };
  return (
    <dl className="op-review">
      {answered.map((s) => (
        <div key={s.id} className="op-review-row">
          <dt>{questionText(s, lang, false)}</dt>
          <dd>
            <span>{render(s)}</span>
            <button type="button" className="op-btn op-btn-link" onClick={() => onEdit(s.id)}>
              {t(schema.ui?.edit, lang, lang === 'am' ? 'አስተካክል' : 'Change')}
              <span className="op-sr"> — {questionText(s, lang, false)}</span>
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsBar({ lang, setLang, simple, setSimple, big, setBig, autoRead, setAutoRead }: {
  lang: Lang; setLang: (l: Lang) => void;
  simple: boolean; setSimple: (b: boolean) => void;
  big: boolean; setBig: (b: boolean) => void;
  autoRead: boolean; setAutoRead: (b: boolean) => void;
}) {
  const L = (am: string, en: string) => (lang === 'am' ? am : en);
  return (
    <div className="op-settings" role="group" aria-label={L('ቅንብሮች', 'Settings')}>
      <div className="op-lang" role="group" aria-label={L('ቋንቋ', 'Language')}>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={lang === 'am'} onClick={() => setLang('am')} lang="am">አማርኛ</button>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">English</button>
      </div>
      {/* Toggle buttons, not checkbox rows: as three stacked 52 px rows this bar ate 287 px of
          a 400 px viewport and covered the question it was supposed to help with. */}
      <div className="op-toggles" role="group" aria-label={L('እርዳታ', 'Help options')}>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={simple} onClick={() => setSimple(!simple)}>
          <Icon name="simple" />{L('ቀላል ቃላት', 'Simple words')}
        </button>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={big} onClick={() => setBig(!big)}>
          <Icon name="text-large" />{L('ትልቅ ጽሑፍ', 'Bigger text')}
        </button>
        <button type="button" className="op-btn op-btn-chip" aria-pressed={autoRead} onClick={() => setAutoRead(!autoRead)}>
          <Icon name="speaker" />{L('ጥያቄ አንብብ', 'Read aloud')}
        </button>
      </div>
    </div>
  );
}
