import type { Lang, LText, Option, Schema, Step } from './types';
import { t, errorText } from './i18n';
import { VoiceButton } from './speech';
import { Icon } from './icons';
import { c } from './copy';

const EC_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];
const EC_MONTHS_OM = ['Fulbaana', 'Onkololeessa', 'Sadaasa', 'Muddee', 'Amajjii', 'Guraandhala', 'Bitooteessa', 'Ebla', 'Caamsaa', 'Waxabajjii', 'Adooleessa', 'Hagayya', 'Phaagumee'];

const isGroup = (type: Step['type']) => type === 'radio' || type === 'checkbox' || type === 'language';

export function questionText(step: Step, lang: Lang, simple: boolean): string {
  const src: LText | undefined = isGroup(step.type) ? (step.legend ?? step.label) : step.label;
  const chosen = simple && step.simple ? step.simple : src;
  return t(chosen ?? src, lang);
}

/* The simple-words layer covers every piece of prose on a screen, not only the heading. Each of
 * these is the single place its text is chosen, so the visible copy and the read-aloud copy are
 * always the same sentence — the bug that bites is one of them being updated and not the other. */
export const hintText = (step: Step, lang: Lang, simple: boolean): string =>
  t((simple && step.simpleHint) || step.hint, lang);
export const whyText = (step: Step, lang: Lang, simple: boolean): string =>
  t((simple && step.simpleWhy) || step.why, lang);
export const bodyText = (step: Step, lang: Lang, simple: boolean): string =>
  t((simple && step.simpleBody) || step.body, lang);
export const optionText = (o: Option, lang: Lang, simple: boolean): string =>
  t((simple && o.simple) || o.label, lang);

interface Props {
  headingId: string;
  step: Step;
  schema: Schema;
  lang: Lang;
  simple: boolean;
  value: unknown;
  errorRule?: { rule: string; params?: Record<string, string | number> };
  onChange: (v: unknown) => void;
}

/** A consent screen must never be filled by dictation. The validator forbids `voice` on these
 *  types (E22); this is the runtime half of the same rule, in case a schema gets hand-edited. */
const isConsentScreen = (s: Step): boolean => s.type === 'statement' || s.type === 'submit';

export function Field({ headingId, step, schema, lang, simple, value, errorRule, onChange }: Props) {
  // Any step with options gets a choice list, whatever widget draws it. This used to be gated on
  // isChoice, so a `select` handed the mic no list: the transcript was accepted, confirmed, and
  // then written nowhere because a dropdown has no option to match it to. Voicing an answer must
  // never be a thing the form accepts and discards.
  // Aliases carry both languages: someone answering in Amharic on an English page (and the
  // other way round) must still be understood, and the alternative transcripts are tried too.
  const choiceList = (step.options ?? []).length
    ? (step.options ?? []).map((o) => ({
        value: o.value,
        label: optionText(o, lang, simple),
        // Both wordings are accepted when speaking: a person who turned simple words on may still
        // say the longer phrase they read somewhere else.
        aliases: [o.label?.am, o.label?.en, o.simple?.am, o.simple?.en, o.value]
          .filter((x): x is string => Boolean(x)),
      }))
    : undefined;
  const hint = hintText(step, lang, simple);
  const why = whyText(step, lang, simple);
  const error = errorText(schema.errors, lang, errorRule);
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
              aria-errormessage={error ? errorId : undefined}
            />
            <span className="op-option-label">{optionText(o, lang, simple)}</span>
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
            aria-labelledby={headingId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? errorId : undefined}
          />
        );
      }
      case 'textarea':
        return (
          <textarea
            id={baseId}
            className="op-input op-textarea"
            aria-labelledby={headingId}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? errorId : undefined}
          />
        );
      case 'select':
        return (
          <select
            id={baseId}
            className="op-input"
            aria-labelledby={headingId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setStr(e.target.value)}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? errorId : undefined}
          >
            <option value="">{t(schema.ui?.choose, lang)}</option>
            {(step.options ?? []).map((o: Option) => (
              <option key={o.value} value={o.value}>{optionText(o, lang, simple)}</option>
            ))}
          </select>
        );
      case 'file': {
        const fileVal = typeof value === 'object' && value !== null ? (value as { name?: string; data?: string; size?: number }) : typeof value === 'string' && value ? { name: value } : undefined;
        const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) {
            onChange(undefined);
            return;
          }
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              const img = new Image();
              img.onload = () => {
                const maxDim = 400;
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                  if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                  } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                  }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const sizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
                onChange({
                  name: file.name,
                  type: 'image/jpeg',
                  size: sizeKb,
                  data: compressedDataUrl,
                });
              };
              img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
          } else {
            onChange({
              name: file.name,
              size: Math.round(file.size / 1024),
            });
          }
        };

        return (
          <div className="op-file-wrap">
            <input
              id={baseId}
              className="op-input"
              type="file"
              aria-labelledby={headingId}
              accept={step.accept}
              onChange={onFileChange}
              aria-describedby={describedBy || undefined}
              aria-invalid={error ? true : undefined}
              aria-errormessage={error ? errorId : undefined}
            />
            {fileVal?.data ? (
              <div className="op-file-preview" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={fileVal.data} alt="" aria-hidden="true" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{fileVal.name}</div>
                  <div className="op-hint" style={{ marginTop: 0 }}>
                    {c('file.compressed', lang)} {fileVal.size ? `(${fileVal.size} KB)` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <p className="op-hint">
                {c('file.demoNote', lang)}
              </p>
            )}
          </div>
        );
      }
      case 'date-ec-gc': {
        const v = (value as { year?: string; month?: string; day?: string; yearOnly?: boolean } | undefined) ?? {};
        const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });
        return (
          <div className="op-date">
            <label className="op-sr" htmlFor={`${baseId}-year`}>{c('date.year', lang)}</label>
            <input id={`${baseId}-year`} className="op-input op-input-sm" inputMode="numeric" placeholder={c('date.year', lang)}
              value={v.year ?? ''} onChange={(e) => set({ year: e.target.value })}
              aria-describedby={describedBy || undefined} aria-invalid={error ? true : undefined} aria-errormessage={error ? errorId : undefined} />
            {!v.yearOnly && (
              <>
                <label className="op-sr" htmlFor={`${baseId}-month`}>{c('date.month', lang)}</label>
                <input id={`${baseId}-month`} className="op-input op-input-sm" inputMode="numeric" placeholder={c('date.month', lang)}
                  value={v.month ?? ''} onChange={(e) => set({ month: e.target.value })}
                  aria-describedby={describedBy || undefined} aria-invalid={error ? true : undefined} aria-errormessage={error ? errorId : undefined} />
                <label className="op-sr" htmlFor={`${baseId}-day`}>{c('date.day', lang)}</label>
                <input id={`${baseId}-day`} className="op-input op-input-sm" inputMode="numeric" placeholder={c('date.day', lang)}
                  value={v.day ?? ''} onChange={(e) => set({ day: e.target.value })}
                  aria-describedby={describedBy || undefined} aria-invalid={error ? true : undefined} aria-errormessage={error ? errorId : undefined} />
              </>
            )}
            <label className="op-check">
              <input type="checkbox" checked={!!v.yearOnly} onChange={(e) => set({ yearOnly: e.target.checked, month: undefined, day: undefined })} />
              <span>{c('date.yearOnly', lang)}</span>
            </label>
            <p className="op-hint">{c('date.hint', lang)}{lang === 'am' || lang === 'ti' ? '' : ` (${lang === 'om' ? EC_MONTHS_OM[0] : EC_MONTHS[0]}…)`}</p>
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
        {step.type === 'statement' && step.body && <p className="op-body">{bodyText(step, lang, simple)}</p>}
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
              {t(schema.ui?.optional, lang)}
            </p>
          )}
          {hint && <p id={hintId} className="op-hint">{hint}</p>}
          <div className="op-options">
            {(() => {
              const baseOpts = step.options ?? [];
              const opts = step.type === 'language' && !baseOpts.some((o) => o.value === 'so')
                ? [
                    ...baseOpts,
                    {
                      value: 'so',
                      label: { en: 'Soomaali' },
                      icon: 'letter-so',
                    },
                  ]
                : baseOpts;
              return opts.map((o) => {
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
                      aria-errormessage={error ? errorId : undefined}
                    />
                    <span className="op-option-label" lang={o.lang ?? undefined}>
                      {o.icon && <Icon name={o.icon} />}
                      {optionText(o, lang, simple)}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </fieldset>
      ) : (
        /* The <h1> above IS the question — icon, wording and all. Repeating it as a field label
         * said everything twice ("ስም" then "ስም") and made a screen reader announce the question
         * twice as well. The input is named from the heading with aria-labelledby, so the one
         * visible copy is also the accessible name. Only the optional marker stays visible, because
         * that is information the heading does not carry. */
        <div className="op-field-control">
          {step.optional && (
            <p className="op-optional op-optional-block">
              {t(schema.ui?.optional, lang)}
            </p>
          )}
          {hint && <p id={hintId} className="op-hint">{hint}</p>}
          {control()}
        </div>
      )}

      {error && (
        <p id={errorId} className="op-error">
          <Icon name="alert" />{error}
        </p>
      )}
      {step.localOnly && <p className="op-private">{t(schema.ui?.notShared, lang)}</p>}

      {step.voice && !isConsentScreen(step) && (
        <VoiceButton
          lang={lang}
          schema={schema}
          fieldType={step.type}
          choices={choiceList}
          /* On the language screen nobody has a language yet, so listen in both and take
             whichever one the engine can actually do. It is the one screen where guessing is
             better than asking. */
          tryLangs={step.type === 'language' ? ['am', 'en'] : [lang]}
          onAccept={(text) => onChange(text.trim())}
          onPick={(value) => {
            if (step.type === 'radio' || step.type === 'language' || step.type === 'select') onChange(value);
            else toggleInArray(value, false, exclusiveValue);
          }}
        />
      )}
    </div>
  );
}
