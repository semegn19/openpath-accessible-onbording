import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang, Schema, Step } from './types';
import { t, tpl } from './i18n';
import { useForm, useCancelSpeechOnKey } from './useForm';
import { Field, questionText } from './fields';
import { ErrorSummary, ReviewScreen, SettingsBar } from './screens';
import { ReadAloudButton, speak } from './speech';
import { Icon } from './icons';

import { useSlug, type Slug } from './router';
import { flush, type SendState } from './api';
import * as outbox from './outbox';

import onboard from './schemas/savanna-onboard-v1.json';
import job from './schemas/savanna-job-v1.json';
import employer from './schemas/employer-accommodations-v1.json';

/** Three forms, three pages, one engine. A fourth is another JSON file and one line here. */
export const PAGES: { slug: Slug; schema: Schema }[] = [
  { slug: 'onboard', schema: onboard as unknown as Schema },
  { slug: 'job', schema: job as unknown as Schema },
  { slug: 'employer', schema: employer as unknown as Schema },
];

/** One page per form, one engine behind all three: /onboard, /job, /employer. */
export default function App() {
  const slug = useSlug('onboard');
  const page = PAGES.find((p) => p.slug === slug) ?? PAGES[0];
  return <Shell key={page.schema.id} schema={page.schema} />;
}

function Shell({ schema }: { schema: Schema }) {
  const f = useForm(schema);
  const { settings, setSettings, step, steps, index, values, errors, errorList } = f;
  const lang = settings.lang;

  useEffect(() => {
    document.title = `${t(schema.title, lang)} — OpenPath`;
  }, [schema.title, lang]);

  // Keep scroll-padding in sync with the sticky bar, so a focused control is never hidden
  // underneath it (WCAG 2.2 SC 2.4.11). Measured, not guessed: the bar changes height with
  // language, "bigger text", and how the labels wrap.
  useEffect(() => {
    const bar = document.querySelector('.op-settingsbar');
    if (!bar) return;
    const sync = () =>
      document.documentElement.style.setProperty('--op-bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(bar);
    window.addEventListener('resize', sync);
    return () => { ro.disconnect(); window.removeEventListener('resize', sync); };
  }, [lang, settings.big, f.submitted, step?.id]);

  const h1 = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const lastStepId = useRef<string | undefined>(undefined);
  const [announce, setAnnounce] = useState('');
  const [send, setSend] = useState<SendState>({ state: 'sending' });
  // navigator.onLine is a hint, not the truth (captive portals, no data on the SIM). It decides
  // the wording of the banner; the actual send decides whether the answers are queued.
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [receipt, setReceipt] = useState<outbox.Receipt | null>(() => outbox.lastReceipt(schema.id) ?? null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  /* ---------------------------------------------------------------- connection
   * Three things share one idea: the device is the source of truth until the server says
   * otherwise. (1) a pending sign-up is picked up on load, (2) every return of the connection
   * flushes the outbox, (3) the banner appears only when there is something worth saying. */

  const attemptSend = useCallback(async (formId: string) => {
    const r = await flush();
    const mine = r.still.filter((q) => q.formId === formId);
    const done = r.sent.filter((q) => outbox.receipts(formId).some((x) => x.ref === q.ref));
    if (mine.length) {
      setSend({ state: 'queued', ref: mine[0].ref, attempts: mine[0].attempts,
                reason: mine[0].lastError === 'offline' || mine[0].lastError === 'no-api' ? 'offline' : 'unreachable' });
      return;
    }
    if (done.length) {
      setSend({ state: 'sent', id: done[0].id, receivedAt: done[0].receivedAt, stripped: done[0].stripped });
      setReceipt(outbox.lastReceipt(formId) ?? null);
    }
  }, []);

  // On load: a sign-up still waiting (or already gone through on another tab) must be visible,
  // not left silently in storage while the form starts over.
  useEffect(() => {
    const waiting = outbox.list(schema.id);
    if (waiting.length) {
      f.adoptSubmitted(waiting[0].answers);
      setSend({ state: 'queued', ref: waiting[0].ref, attempts: waiting[0].attempts,
                reason: waiting[0].lastError === 'rejected' ? 'unreachable' : 'offline' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.id]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      if (outbox.pending(schema.id)) void attemptSend(schema.id);
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && outbox.pending(schema.id)) void attemptSend(schema.id);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [schema.id, attemptSend]);

  // Say the connection state once, politely. Not on every render, not every 5 seconds.
  const announcedNet = useRef<boolean | null>(null);
  useEffect(() => {
    if (announcedNet.current === online) return;
    announcedNet.current = online;
    setAnnounce(
      online
        ? lang === 'am' ? 'ግንኙነቱ ተመልሷል።' : 'You are back online.'
        : lang === 'am' ? 'ግንኙነት የለም። መልሶችዎ በዚህ መሣሪያ ላይ ይቀመጣሉ።' : 'You are offline. Your answers are being kept on this device.',
    );
  }, [online, lang]);

  useCancelSpeechOnKey(() => window.speechSynthesis?.cancel());

  // Move focus to the question on every step CHANGE. Not on first load — stealing focus
  // before the user does anything hides the skip link and surprises screen-reader users.
  useEffect(() => {
    if (!step) return;
    if (lastStepId.current === step.id) return;
    const isFirstLoad = lastStepId.current === undefined;
    lastStepId.current = step.id;
    if (!isFirstLoad) h1.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // WCAG 4.1.3: the draft saves silently. Say so — but at most once every 15 s, or a screen
  // reader user gets a message per keystroke and the form becomes unusable.
  const savedSpokenAt = useRef(0);
  const firstSave = useRef(true);
  useEffect(() => {
    if (f.submitted) return;
    if (firstSave.current) { firstSave.current = false; return; }
    const id = setTimeout(() => {
      const now = Date.now();
      if (now - savedSpokenAt.current < 15_000) return;
      savedSpokenAt.current = now;
      setAnnounce(lang === 'am' ? 'መልሶችዎ ተቀምጠዋል።' : 'Your answers were saved.');
    }, 1500);
    return () => clearTimeout(id);
  }, [f.values, f.submitted, lang]);

  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    if (errorList.length) summary.current?.focus();
  }, [errorList.length, errors, attempts]);

  // A conditional answer can add a question later (7 → 8 steps). The progress text
  // changes; nothing announces it. Say it once, politely.
  const stepCount = steps.length;
  const prevCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (prevCount.current === undefined) { prevCount.current = stepCount; return; }
    if (prevCount.current === stepCount) return;
    const grew = stepCount > prevCount.current;
    prevCount.current = stepCount;
    if (!grew) return;
    setAnnounce(
      tpl(t(schema.ui?.stepOf, lang, lang === 'am' ? 'ደረጃ {n} ከ {total}' : 'Step {n} of {total}'), {
        n: index + 1,
        total: stepCount,
      }) + (lang === 'am' ? ' — አዲስ ጥያቄ ተጨምሯል።' : ' — a new question was added.'),
    );
  }, [stepCount]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (f.submitted) h1.current?.focus();
  }, [f.submitted]);

  const stepId = step?.id;
  useEffect(() => {
    if (!settings.readAloud || !step) return;
    speak(readAloudText(step), lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, settings.readAloud, lang, settings.simple]);

  /** The support question *is* the settings panel: choosing support turns it on.
   *  Nothing ever turns an accommodation off automatically — only the user can, at the top. */
  const applySupport = (picked: string[]) =>
    setSettings((s) => ({
      ...s,
      readAloud: s.readAloud || picked.includes('read-aloud'),
      big: s.big || picked.includes('large-text'),
      simple: s.simple || picked.includes('simple-words'),
    }));

  const handleChange = (s: Step, v: unknown) => {
    f.setValue(s.id, v);

    if (s.type === 'language' && (v === 'am' || v === 'en')) {
      setSettings((prev) => ({ ...prev, lang: v }));
      // A language change re-renders every string; say so, in the new language.
      setAnnounce(v === 'am' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል።' : 'Language changed to English.');
    }

    if (s.id === 'accessibility-prefs' && (s.options ?? []).some((o) => o.applies)) {
      const picked = Array.isArray(v) ? (v as string[]) : [];
      const exclusive = (s.options ?? []).find((o) => o.exclusive)?.value;
      // Turning an accommodation on changes the page under the user's feet. Announce it.
      const before = settings;
      applySupport(picked);
      const on: string[] = [];
      if (!before.readAloud && picked.includes('read-aloud')) on.push(lang === 'am' ? 'ጥያቄዎች ይነበባሉ' : 'questions will be read aloud');
      if (!before.big && picked.includes('large-text')) on.push(lang === 'am' ? 'ጽሑፉ ጨምሯል' : 'text is now bigger');
      if (!before.simple && picked.includes('simple-words')) on.push(lang === 'am' ? 'ቀላል ቃላት በርተዋል' : 'simple words are on');
      // Choosing the exclusive option silently wipes the others — that is a surprise, so say it.
      if (exclusive && picked.includes(exclusive) && picked.length === 1) {
        setAnnounce(lang === 'am' ? 'ሌሎቹ ምርጫዎች ተነስተዋል።' : 'Your other choices were cleared.');
      } else if (on.length) {
        setAnnounce(on.join(lang === 'am' ? '፣ ' : ', ') + '.');
      }
    }
  };

  if (f.submitted) {
    return (
      <div className="op-shell" data-big={settings.big || undefined}>
        <div className="op-band">
          <p className="op-brand">{t(schema.title, lang)}</p>
        </div>
        <main className="op-root op-done">
          <h1 ref={h1} tabIndex={-1} className="op-h1" id="op-q-title">
            <Icon name={send.state === 'sent' ? 'check' : send.state === 'sending' ? 'clock' : 'alert'} />
            {send.state === 'sent'
              ? (lang === 'am' ? 'ምዝገባው ተጠናቅቋል' : 'Sign-up complete')
              : send.state === 'sending'
                ? (lang === 'am' ? 'በመላክ ላይ…' : 'Sending…')
                : send.state === 'rejected'
                  ? (lang === 'am' ? 'አልተላከም' : 'Not sent yet')
                  : (lang === 'am' ? 'በዚህ መሣሪያ ላይ ተቀምጧል' : 'Saved on this device')}
          </h1>

          <p role="status" aria-live="polite" className="op-receipt">
            {send.state === 'sent' && (
              <>
                <span>{lang === 'am' ? 'የማጣቀሻ ቁጥርዎ፦' : 'Your reference:'}</span>
                {/* on its own line: an id broken mid-token reads like a rendering bug */}
                <span className="op-mono op-ref">{send.id}</span>
                <span className="op-hint">{lang === 'am' ? 'ይህን ቁጥር ይያዙት።' : 'Keep this number.'}</span>
              </>
            )}
            {send.state === 'sending' && (lang === 'am' ? 'እባክዎ ይጠብቁ።' : 'Please wait.')}
            {send.state === 'queued' && (
              <>
                {send.reason === 'full'
                  ? lang === 'am'
                    ? 'ይህ መሣሪያ ማስቀመጥ አልቻለም። መልሶችዎ አሁንም በዚህ ገጽ ላይ አሉ። እባክዎ ገጹን አይዝጉ።'
                    : 'This device would not store it. Your answers are still on this page — please do not close it.'
                  : lang === 'am'
                    ? 'አገልጋዩን ማግኘት አልቻልንም። መልሶችዎ በዚህ መሣሪያ ላይ ተቀምጠዋል እና ግንኙነት ሲመጣ በራሳቸው ይላካሉ። ገጹን መዝጋት ይችላሉ።'
                    : 'We could not reach the server. Your answers are saved on this device and will send themselves when the connection comes back. You can close this page.'}
              </>
            )}
            {send.state === 'rejected' && (
              <>
                {lang === 'am' ? 'አገልጋዩ እነዚህን መልሶች መቀበል አልቻለም። ' : 'The server could not accept these answers. '}
                <span className="op-hint">{send.detail}</span>
              </>
            )}
          </p>
          {/* The reference number is the one thing the learner has to carry away. Somebody who
              used read-aloud through the whole form must not hit a silent wall at the last step. */}
          <ReadAloudButton
            text={
              (send.state === 'sent'
                ? lang === 'am'
                  ? `ምዝገባው ተጠናቅቋል። የማጣቀሻ ቁጥርዎ ${send.id.split('').join(' ')}። ይህን ቁጥር ይያዙት።`
                  : `Sign-up complete. Your reference is ${send.id.split('').join(' ')}. Keep this number.`
                : send.state === 'sending'
                  ? lang === 'am' ? 'በመላክ ላይ። እባክዎ ይጠብቁ።' : 'Sending. Please wait.'
                  : lang === 'am'
                    ? 'መልሶችዎ በዚህ መሣሪያ ላይ ተቀምጠዋል። ግንኙነት ሲመጣ በራሳቸው ይላካሉ። ገጹን መዝጋት ይችላሉ።'
                    : 'Your answers are saved on this device. They will send themselves when the connection returns. You can close this page.')
            }
            lang={lang}
            schema={schema}
          />

          {send.state === 'sent' && <p>{lang === 'am' ? 'አመሰግናለሁ።' : 'Thank you.'}</p>}

          {send.state === 'queued' && send.reason !== 'full' && (
            <div className="op-nav">
              <button
                type="button"
                className="op-btn op-btn-primary"
                disabled={retrying}
                onClick={() => {
                  setRetrying(true);
                  setSend({ state: 'sending' });
                  void attemptSend(schema.id).finally(() => setRetrying(false));
                }}
              >
                {retrying
                  ? lang === 'am' ? 'በመሞከር ላይ…' : 'Trying…'
                  : lang === 'am' ? 'አሁን እንደገና ሞክር' : 'Try sending now'}
              </button>
            </div>
          )}
          <details>
            <summary>{send.state === 'sent'
              ? lang === 'am' ? 'የተላከው መረጃ' : 'What was sent'
              : lang === 'am' ? 'ምን ይላካል' : 'What will be sent'}</summary>
            <pre className="op-payload">{JSON.stringify(f.submitted, null, 2)}</pre>
            <p className="op-hint">
              {lang === 'am'
                ? 'የእርዳታ መልሶች በዚህ ዝርዝር ውስጥ የሉም።'
                : 'The support answers are not in this payload — they never left the phone.'}
            </p>
          </details>
        </main>
      </div>
    );
  }

  const isReview = step?.type === 'review';
  const isSubmit = step?.type === 'submit';
  // Read-aloud is available on every screen EXCEPT language (we cannot know which voice yet)
  // and review (it is a summary, not a question). It is REQUIRED on consent screens.
  const showReadAloud = step && !isReview && step.type !== 'language';

  // On a consent screen the question alone ("Confirmation") says nothing — read the body too.
  const readAloudText = (st: Step): string => {
    const parts = [questionText(st, lang, settings.simple), t(st.hint, lang)];
    if (st.body) parts.push(t(st.body, lang));
    if (st.type === 'statement' || st.type === 'submit') {
      for (const o of st.options ?? []) parts.push(t(o.label, lang));
    }
    return parts.filter(Boolean).join(' ');
  };
  const progress = tpl(t(schema.ui?.stepOf, lang, lang === 'am' ? 'ደረጃ {n} ከ {total}' : 'Step {n} of {total}'), { n: index + 1, total: steps.length });

  return (
    <div className="op-shell" data-big={settings.big || undefined}>
      <a className="op-skip" href="#op-main">
        {lang === 'am' ? 'ወደ ዋና ይዘት ዝለል' : 'Skip to main content'}
      </a>
      <header className="op-band">
        <p className="op-brand">{t(schema.title, lang)}</p>
      </header>

      <div className="op-settingsbar">
        <SettingsBar
          lang={lang} setLang={(l: Lang) => setSettings({ ...settings, lang: l })}
          simple={settings.simple} setSimple={(b) => setSettings({ ...settings, simple: b })}
          big={settings.big} setBig={(b) => setSettings({ ...settings, big: b })}
          autoRead={settings.readAloud} setAutoRead={(b) => setSettings({ ...settings, readAloud: b })}
        />
      </div>

      <p className="op-sr" role="status" aria-live="polite">{announce}</p>

      <main className="op-root" id="op-main" tabIndex={-1}>
        {!online && !f.submitted && (
          <div className="op-net">
            <Icon name="alert" />
            <p>
              <strong>{lang === 'am' ? 'ግንኙነት የለም።' : 'No connection.'}</strong>{' '}
              {lang === 'am'
                ? 'መልሶችዎ በዚህ መሣሪያ ላይ ይቀመጣሉ፤ ግንኙነት ሲመጣ በራሳቸው ይላካሉ።'
                : 'Your answers are kept on this device and will send themselves when the connection returns.'}
            </p>
          </div>
        )}

        {receipt && !f.submitted && (
          <div className="op-banner" role="status">
            <p>
              {lang === 'am' ? 'የመጨረሻው ምዝገባ ተልኳል። የማጣቀሻ ቁጥር፦ ' : 'Your last sign-up was sent. Reference: '}
              <span className="op-mono op-ref">{receipt.id}</span>
            </p>
            <button type="button" className="op-btn" onClick={() => { outbox.clearReceipts(); setReceipt(null); }}>
              {lang === 'am' ? 'ዝጋ' : 'Dismiss'}
            </button>
          </div>
        )}

        {f.restored && (
          <div className="op-banner" role="status">
            <p>{lang === 'am' ? 'ያልተጠናቀቀ ምዝገባ አለ። መልሶችዎ ተቀምጠዋል።' : 'You have an unfinished form. Your answers were restored.'}</p>
            <button type="button" className="op-btn" onClick={() => f.discardDraft()}>
              {lang === 'am' ? 'አዲስ ጀምር' : 'Start again'}
            </button>
          </div>
        )}

        <ErrorSummary ref={summary} items={errorList} lang={lang} schema={schema} onJump={f.goTo} />

        <p className="op-progress">{progress}</p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setAttempts((n) => n + 1);
            if (isSubmit) {
              const payload = f.submit();
              if (!payload) return;

              // 1. Write it down. 2. Then try to send it. Never the other way round.
              const entry = outbox.enqueue(schema.id, payload);
              if (!entry) {
                // The device refused to store it (quota, private mode). Do not clear the draft,
                // do not say "saved". Say what is true: it is on screen, keep this page.
                setSend({ state: 'queued', ref: '', attempts: 0, reason: 'full' });
                return;
              }
              f.clearDraft();                       // the outbox holds these answers now
              setSend({ state: 'sending' });
              void flush([entry]).then((r) => {
                const mine = r.sent.find((q) => q.ref === entry.ref);
                const left = r.still.find((q) => q.ref === entry.ref);
                if (mine) {
                  setSend({ state: 'sent', id: mine.id, receivedAt: mine.receivedAt, stripped: mine.stripped });
                  setReceipt(outbox.lastReceipt(schema.id) ?? null);
                } else if (left) {
                  setSend({ state: 'queued', ref: entry.ref, attempts: left.attempts,
                            reason: left.lastError === 'rejected' ? 'unreachable' : 'offline' });
                }
              });
            } else f.next();
          }}
        >
          <h1 ref={h1} tabIndex={-1} className="op-h1" id="op-q-title">
            {step.icon && !isReview && !isSubmit && <Icon name={step.icon} />}
            {isReview || isSubmit ? t(step.label, lang) : questionText(step, lang, settings.simple)}
          </h1>

          {index === 0 && schema.intro && <p className="op-intro">{t(schema.intro, lang)}</p>}

          {isReview ? (
            <ReviewScreen steps={steps} values={values} lang={lang} schema={schema} onEdit={f.goTo} />
          ) : (
            <>
              {showReadAloud && (
                <ReadAloudButton text={readAloudText(step)} lang={lang} schema={schema} />
              )}
              <Field
                headingId="op-q-title"
                step={step} schema={schema} lang={lang} simple={settings.simple}
                value={values[step.id]} errorRule={errors[step.id]}
                onChange={(v) => handleChange(step, v)}
              />
            </>
          )}

          <div className="op-nav">
            {index > 0 && (
              <button type="button" className="op-btn op-btn-back" onClick={f.back}>
                <span aria-hidden="true">← </span>{t(schema.ui?.back, lang, lang === 'am' ? 'ተመለስ' : 'Back')}
              </button>
            )}
            <button type="submit" className="op-btn op-btn-primary">
              {isSubmit ? t(step.submitLabel, lang) : t(schema.ui?.next, lang, lang === 'am' ? 'ቀጣይ' : 'Next')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
