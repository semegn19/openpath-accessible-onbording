import type { Lang, LText, Option, Schema, Step } from './types';
import { t } from './i18n';
import { VoiceButton } from './speech';
import { Icon } from './icons';

const EC_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];

const isGroup = (type: Step['type']) => type === 'radio' || type === 'checkbox' || type === 'language';

export function questionText(step: Step, lang: Lang, simple: boolean): string {
  const src: LText | undefined = isGroup(step.type) ? (step.legend ?? step.label) : step.label;
  const chosen = simple && step.simple ? step.simple : src;
  return t(chosen ?? src, lang);
}

interface Props {
  headingId: string;
  step: Step;
  schema: Schema;
  lang: Lang;
  simple: boolean;
  value: unknown;
  errorRule?: string;
  onChange: (v: unknown) => void;
}

/** A consent screen must never be filled by dictation. The validator forbids `voice` on these
 *  types (E22); this is the runtime half of the same rule, in case a schema gets hand-edited. */
const isConsentScreen = (s: Step): boolean => s.type === 'statement' || s.type === 'submit';

export function Field({ headingId, step, schema, lang, simple, value, errorRule, onChange }: Props) {
  const label = questionText(step, lang, simple);
  const hint = t(step.hint, lang);
  const why = t(step.why, lang);
  const error = errorRule ? t(schema.errors[errorRule], lang, errorRule) : '';
  const baseId = step.id;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const setStr = (v: string) => onChange(v);
  const toggleInArray = (v: string, exclusive?: boolean, exclusiveValue?: string) => {
    const arr = Array.isArray(value) ? ([...value] as string[]) : [];
    if (exclusive) return onChange(arr.includes(v) ? [] : [v]);
    const withoutExclusive = arr.filter((x) => x !== exclusiveValue);
    return onChange(withoutExclusive.includes(v) ? withoutExclusive.filter((x) => x !== v) : [...withoutExclusive, v]);
  };
  const exclusiveValue = (step.options ?? []).find((o) => o.exclusive)?.value;

  const consentList = () => (
    <div className="op-options">
      {(step.options ?? []).map((o) => {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        return (
          <label key={o.value} className="op-check">
            <input
              type="checkbox"
              name={step.id}
              value={o.value}
              checked={arr.includes(o.value)}
              onChange={() => onChange(arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
              aria-describedby={describedBy || undefined}
              aria-invalid={error ? true : undefined}
            />
            <span className="op-option-label">{t(o.label, lang)}</span>
          </label>
        );
      })}
    </div>
  );

  const control = () => {
    switch (step.type) {
      case 'text':
      case 'tel':
      case 'email':
      case 'number': {
        const type = step.type === 'number' ? 'text' : step.type;
        return (
          <input
            id={baseId}
            className="op-input"
            type={type}
            inputMode={step.inputmode as 'text' | 'tel' | 'email' | 'numeric' | undefined}
            /* SC 1.3.5 Identify Input Purpose: the browser (and a password manager, and a
               screen reader) can fill a name or a phone number instead of asking someone to
               retype it — which matters most for exactly the people this form is for. */
            autoComplete={step.autocomplete ?? 'off'}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
          />
        );
      }
      case 'textarea':
        return (
          <textarea
            id={baseId}
            className="op-input op-textarea"
            rows={4}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
          />
        );
      case 'select':
        return (
          <select
            id={baseId}
            className="op-input"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
          >
            <option value="">{t(schema.ui?.choose, lang, lang === 'am' ? 'ከዝርዝሩ ይምረጡ' : 'Choose one')}</option>
            {(step.options ?? []).map((o: Option) => (
              <option key={o.value} value={o.value}>{t(o.label, lang)}</option>
            ))}
          </select>
        );
      case 'file':
        return (
          <div>
            <input
              id={baseId}
              className="op-input"
              type="file"
              accept={step.accept}
              onChange={(e) => setStr(e.target.files?.[0]?.name ?? '')}
              aria-describedby={describedBy || undefined}
            />
            <p className="op-hint">
              {lang === 'am'
                ? 'በዚህ ሙከራ ውስጥ ፋይሉ አይላክም። ስሙ ብቻ ይታያል።'
                : 'In this demo the file is not uploaded. Only its name is used.'}
            </p>
          </div>
        );
      case 'date-ec-gc': {
        const v = (value as { year?: string; month?: string; day?: string; yearOnly?: boolean } | undefined) ?? {};
        const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });
        return (
          <div className="op-date">
            <label className="op-sr" htmlFor={`${baseId}-year`}>{lang === 'am' ? 'ዓመት' : 'Year'}</label>
            <input id={`${baseId}-year`} className="op-input op-input-sm" inputMode="numeric" placeholder={lang === 'am' ? 'ዓመት' : 'Year'}
              value={v.year ?? ''} onChange={(e) => set({ year: e.target.value })} aria-describedby={describedBy || undefined} />
            {!v.yearOnly && (
              <>
                <label className="op-sr" htmlFor={`${baseId}-month`}>{lang === 'am' ? 'ወር' : 'Month'}</label>
                <input id={`${baseId}-month`} className="op-input op-input-sm" inputMode="numeric" placeholder={lang === 'am' ? 'ወር' : 'Month'}
                  value={v.month ?? ''} onChange={(e) => set({ month: e.target.value })} aria-describedby={describedBy || undefined} />
                <label className="op-sr" htmlFor={`${baseId}-day`}>{lang === 'am' ? 'ቀን' : 'Day'}</label>
                <input id={`${baseId}-day`} className="op-input op-input-sm" inputMode="numeric" placeholder={lang === 'am' ? 'ቀን' : 'Day'}
                  value={v.day ?? ''} onChange={(e) => set({ day: e.target.value })} aria-describedby={describedBy || undefined} />
              </>
            )}
            <label className="op-check">
              <input type="checkbox" checked={!!v.yearOnly} onChange={(e) => set({ yearOnly: e.target.checked, month: undefined, day: undefined })} />
              <span>{lang === 'am' ? 'ዓመቱን ብቻ አውቃለሁ' : 'I only know the year'}</span>
            </label>
            <p className="op-hint">{lang === 'am' ? 'የኢትዮጵያ ዓመት — ለምሳሌ 1988' : `Ethiopian year — for example 1988 (${EC_MONTHS[0]}…)`}</p>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // statement / submit: the <h1> is the question, so no extra label or legend here
  if (step.type === 'statement' || step.type === 'submit') {
    return (
      <div className="op-field">
        {why && <p className="op-why">{why}</p>}
        {step.type === 'statement' && step.body && <p className="op-body">{t(step.body, lang)}</p>}
        {consentList()}
        {error && (
          <p id={errorId} className="op-error"><Icon name="alert" />{error}</p>
        )}
        {step.localOnly && <p className="op-private">{t(schema.ui?.notShared, lang)}</p>}
      </div>
    );
  }

  return (
    <div className="op-field">
      {why && <p className="op-why">{why}</p>}
      {isGroup(step.type) ? (
        <fieldset className="op-fieldset" aria-labelledby={headingId}>
          {step.optional && (
            <p className="op-optional op-optional-block">
              {t(schema.ui?.optional, lang, lang === 'am' ? 'አስፈላጊ አይደለም' : 'Optional')}
            </p>
          )}
          {hint && <p id={hintId} className="op-hint">{hint}</p>}
          <div className="op-options">
            {(step.options ?? []).map((o) => {
              const arr = Array.isArray(value) ? (value as string[]) : [];
              const single = step.type === 'radio' || step.type === 'language';
              const checked = single ? value === o.value : arr.includes(o.value);
              return (
                <label key={o.value} className="op-option">
                  <input
                    type={step.type === 'checkbox' ? 'checkbox' : 'radio'}
                    name={step.id}
                    value={o.value}
                    checked={checked}
                    onChange={() => (step.type === 'checkbox' ? toggleInArray(o.value, o.exclusive, exclusiveValue) : onChange(o.value))}
                    aria-describedby={describedBy || undefined}
                    aria-invalid={error ? true : undefined}
                  />
                  <span className="op-option-label">
                    {o.icon && <Icon name={o.icon} />}
                    {t(o.label, lang)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="op-field-control">
          <label htmlFor={baseId} className="op-label">
            {step.icon && <Icon name={step.icon} />}
            {label}
            {step.optional && <span className="op-optional"> ({t(schema.ui?.optional, lang, lang === 'am' ? 'አስፈላጊ አይደለም' : 'Optional')})</span>}
          </label>
          {hint && <p id={hintId} className="op-hint">{hint}</p>}
          {control()}
        </div>
      )}

      {error && (
        <p id={errorId} className="op-error">
          <Icon name="alert" />{error}
        </p>
      )}
      {step.localOnly && <p className="op-private">{t(schema.ui?.notShared, lang, lang === 'am' ? 'ይህ መረጃ ወደ ማንም አይላክም።' : 'This is not sent to anyone.')}</p>}

      {step.voice && !isConsentScreen(step) && (
        <VoiceButton
          lang={lang}
          schema={schema}
          fieldType={step.type}
          onAccept={(text) => {
            if (step.type === 'checkbox' || step.type === 'radio') {
              const match = (step.options ?? []).find((o) => t(o.label, lang).includes(text.trim()));
              if (match) step.type === 'radio' ? onChange(match.value) : toggleInArray(match.value, match.exclusive, exclusiveValue);
            } else {
              onChange(text.trim());
            }
          }}
        />
      )}
    </div>
  );
}
