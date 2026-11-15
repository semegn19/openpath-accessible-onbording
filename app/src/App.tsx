import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang, Schema, Step } from './types';
import { t, tpl, errorText } from './i18n';
import { useForm, useCancelSpeechOnKey } from './useForm';
import { Field, questionText, hintText, whyText, bodyText, optionText } from './fields';
import { ErrorSummary, ReviewScreen, SettingsBar, reviewText } from './screens';
import { ReadAloudButton, speak } from './speech';
import { stopAudio } from './audio';
import { Icon } from './icons';
import { syncJsonLdScript } from './jsonld';

import { useSlug, type Slug } from './router';
import { flush, type SendState } from './api';
import * as outbox from './outbox';

import { c } from './copy';
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

function postToParent(type: string, payload: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'openpath', v: 1, type, ...payload }, '*');
  }
}

function Shell({ schema }: { schema: Schema }) {
  const f = useForm(schema);
  const { settings, setSettings, step, steps, index, values, errors, errorList } = f;
  const lang = settings.lang;
  const isEmbed = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('embed') === '1' || window.parent !== window);

  // In embed mode, take initial language from ?lang= query param if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lp = params.get('lang');
    if (lp === 'am' || lp === 'en' || lp === 'om' || lp === 'ti') {
      setSettings((s) => (s.lang === lp ? s : { ...s, lang: lp }));
    }
  }, [setSettings]);

  // Integration Level 1 postMessage bridge
  useEffect(() => {
    if (!isEmbed) return;
    postToParent('ready', { formId: schema.id, lang });
  }, [isEmbed, schema.id, lang]);

  useEffect(() => {
    if (!isEmbed) return;
    postToParent('step', { formId: schema.id, stepId: step?.id, index, total: steps.length });
  }, [isEmbed, schema.id, step?.id, index, steps.length]);

  useEffect(() => {
    if (!isEmbed) return;
    const notifyHeight = () => {
      const shell = document.querySelector('.op-shell');
      const height = Math.ceil(shell ? shell.getBoundingClientRect().height : document.body.scrollHeight);
      postToParent('resize', { height: Math.max(500, height) });
    };
    notifyHeight();
    const ro = new ResizeObserver(notifyHeight);
    const shell = document.querySelector('.op-shell');
    if (shell) ro.observe(shell);
    window.addEventListener('resize', notifyHeight);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', notifyHeight);
    };
  }, [isEmbed, step?.id, index, settings, values, f.submitted]);

  useEffect(() => {
    if (!isEmbed) return;
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.source === 'openpath-host' && e.data.v === 1) {
        if (e.data.type === 'set-lang' && ['am', 'en', 'om', 'ti'].includes(e.data.lang)) {
          setSettings((s) => ({ ...s, lang: e.data.lang }));
        } else if (e.data.type === 'set-settings' && e.data.settings) {
          setSettings((s) => ({ ...s, ...e.data.settings }));
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isEmbed, setSettings]);

  useEffect(() => {
    document.title = `${t(schema.title, lang)} — OpenPath`;
  }, [schema.title, lang]);

  useEffect(() => {
    return syncJsonLdScript(schema, f.values, lang);
  }, [schema, f.values, lang]);

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
  const [smsSent, setSmsSent] = useState(false);
  const lastSmsPhone = useRef<string>('');

  // Restore from URL query token if ?resume=<token>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const resumeToken = params.get('resume');
    if (!resumeToken) return;
    fetch(`/api/checkpoints/${encodeURIComponent(resumeToken)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.checkpoint) {
          const cp = data.checkpoint;
          f.restoreCheckpoint(cp.answers, cp.currentStep);
        }
      })
      .catch(() => {});
  }, []);

  // When connection drops on an unfinished form with a phone number, send SMS resume link
  useEffect(() => {
    if (online) {
      setSmsSent(false);
      return;
    }
    const phone = f.values.phone as string | undefined;
    if (!phone || f.submitted) return;
    setSmsSent(true);
    if (lastSmsPhone.current === phone) return;
    lastSmsPhone.current = phone;
    const payload = JSON.stringify({
      phone,
      answers: f.values,
      currentStep: f.index,
      stepId: step?.id,
      formId: schema.id,
      lang,
      origin: window.location.origin,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/sms/send-resume', payload);
      }
    } catch { /* ignore */ }
    fetch('/api/sms/send-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => {});
  }, [online, f.values.phone, f.submitted, f.index, step?.id, schema.id, lang]);

  useEffect(() => {
    if (announcedNet.current === online) return;
    announcedNet.current = online;
    setAnnounce(
      online
        ? c('announce.backOnline', lang)
        : c('announce.offline', lang),
    );
  }, [online, lang]);

  useCancelSpeechOnKey(() => {
    window.speechSynthesis?.cancel();
    stopAudio();                       // any keypress stops a recording too, not only TTS
  });

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
      setAnnounce(c('announce.saved', lang));
    }, 1500);
    return () => clearTimeout(id);
  }, [f.values, f.submitted, lang]);

  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    if (errorList.length) {
      summary.current?.focus();
      const msg = t(schema.ui?.errorSummary, lang) + ' — ' +
        errorList.map((e) => `${questionText(e.step, lang, false)}: ${errorText(schema.errors, lang, e.rule)}`).join('. ');
      setAnnounce('');
      const tid = setTimeout(() => setAnnounce(msg), 50);
      return () => clearTimeout(tid);
    }
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
      tpl(t(schema.ui?.stepOf, lang), {
        n: index + 1,
        step: index + 1,
        total: stepCount,
      }) + (' — ' + c('announce.newQuestion', lang)),
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

  /** The support question *is* the settings panel: the boxes show what is on, and ticking or
   *  un-ticking one changes it immediately — in both directions, because a checkbox that cannot be
   *  un-ticked while it sits in the "on" position is a lie about the state of the page. */
  const applySupport = (picked: string[]) =>
    setSettings((s) => ({
      ...s,
      readAloud: picked.includes('read-aloud'),
      big: picked.includes('large-text'),
      simple: picked.includes('simple-words'),
    }));

  /** What is applied *right now*. The settings bar at the top can change these at any moment, so a
   *  step that displays them must read the settings, not a value typed into it earlier — otherwise
   *  the box and the chip above disagree about the same switch. */
  const appliedValue = (st: Step): unknown => {
    if (st.type === 'language') return settings.lang;
    if ((st.options ?? []).some((o) => o.applies)) {
      return (st.options ?? [])
        .filter((o) => o.applies && settings[o.applies as 'readAloud' | 'big' | 'simple'])
        .map((o) => o.value);
    }
    return values[st.id];
  };

  /** The two opening steps are not ordinary answers: they describe the form's own state. Keep the
   *  stored answer in step with what is applied, so validation, the review screen and the submitted
   *  payload all agree with the radio and the checkboxes the person can see. */
  useEffect(() => {
    const langStep = schema.steps.find((st) => st.type === 'language');
    if (langStep && values[langStep.id] !== settings.lang) f.setValue(langStep.id, settings.lang);
    const prefStep = schema.steps.find((st) => (st.options ?? []).some((o) => o.applies));
    if (prefStep) {
      const applied = (prefStep.options ?? [])
        .filter((o) => o.applies && settings[o.applies as 'readAloud' | 'big' | 'simple'])
        .map((o) => o.value);
      const stored = Array.isArray(values[prefStep.id]) ? (values[prefStep.id] as string[]) : [];
      const same = applied.length === stored.length && applied.every((v) => stored.includes(v));
      if (!same) f.setValue(prefStep.id, applied);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.lang, settings.readAloud, settings.big, settings.simple, schema.id]);

  const handleChange = (s: Step, v: unknown) => {
    f.setValue(s.id, v);

    if (s.type === 'language' && (v === 'am' || v === 'en' || v === 'om' || v === 'ti')) {
      const nextLang = v as Lang;
      setSettings((prev) => ({ ...prev, lang: nextLang }));
      // A language change re-renders every string; say so, in the new language.
      setAnnounce(c('announce.langChanged', nextLang));
    }

    // Any step whose options declare what they change about the page — not one hardcoded id,
    // so every form can offer the same accessibility choices.
    if ((s.options ?? []).some((o) => o.applies)) {
      const picked = Array.isArray(v) ? (v as string[]) : [];
      const exclusive = (s.options ?? []).find((o) => o.exclusive)?.value;
      // Turning an accommodation on changes the page under the user's feet. Announce it.
      const before = settings;
      applySupport(picked);
      const on: string[] = [];
      if (!before.readAloud && picked.includes('read-aloud')) on.push(c('announce.readAloudOn', lang));
      if (!before.big && picked.includes('large-text')) on.push(c('announce.bigOn', lang));
      if (!before.simple && picked.includes('simple-words')) on.push(c('announce.simpleOn', lang));
      // Choosing the exclusive option silently wipes the others — that is a surprise, so say it.
      if (exclusive && picked.includes(exclusive) && picked.length === 1) {
        setAnnounce(c('announce.choicesCleared', lang));
      } else if (on.length) {
        setAnnounce(on.join(lang === 'am' || lang === 'ti' ? '፣ ' : ', ') + '.');
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
          {(() => {
            const isPartner = f.submitted && (f.submitted as Record<string, unknown>)['id-route'] === 'refer';
            return (
              <>
                <h1 ref={h1} tabIndex={-1} className="op-h1" id="op-q-title">
                  <Icon name={send.state === 'sent' ? 'check' : send.state === 'sending' ? 'clock' : 'alert'} />
                  {send.state === 'sent'
                    ? (isPartner ? c('status.pendingPartner', lang) : c('status.complete', lang))
                    : send.state === 'sending'
                      ? (c('status.sending', lang))
                      : send.state === 'rejected'
                        ? (c('status.rejected', lang))
                        : (c('status.saved', lang))}
                </h1>

                <p role="status" aria-live="polite" className="op-receipt">
                  {send.state === 'sent' && (
                    <>
                      <span>{c('receipt.reference', lang)}</span>
                      {/* on its own line: an id broken mid-token reads like a rendering bug */}
                      <span className="op-mono op-ref">{send.id}</span>
                      <span className="op-hint">{c('receipt.keep', lang)}</span>
                      {isPartner && <span className="op-hint">{c('receipt.pendingPartnerHelp', lang)}</span>}
                    </>
                  )}
                  {send.state === 'sending' && (c('status.wait', lang))}
                  {send.state === 'queued' && (
                    <>
                      {send.reason === 'full'
                        ? c('send.storageFull', lang)
                        : c('send.unreachable', lang)}
                    </>
                  )}
                  {send.state === 'rejected' && (
                    <>
                      {c('send.rejected', lang)}
                      <span className="op-hint">{send.detail}</span>
                    </>
                  )}
                </p>
                {/* The reference number is the one thing the learner has to carry away. Somebody who
                    used read-aloud through the whole form must not hit a silent wall at the last step. */}
                <ReadAloudButton
                  text={
                    (send.state === 'sent'
                      ? tpl(isPartner ? c('announce.pendingPartner', lang) : c('announce.complete', lang), { ref: send.id.split('').join(' ') })
                      : send.state === 'sending'
                        ? c('announce.sending', lang)
                        : c('send.queued', lang))
                  }
                  lang={lang}
                  schema={schema}
                />
              </>
            );
          })()}

          {send.state === 'sent' && <p>{c('status.thanks', lang)}</p>}

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
                  ? c('retry.trying', lang)
                  : c('retry.now', lang)}
              </button>
            </div>
          )}
          <details>
            <summary>{send.state === 'sent'
              ? c('sent.wasSent', lang)
              : c('sent.willSend', lang)}</summary>
            <pre className="op-payload">{JSON.stringify(f.submitted, null, 2)}</pre>
            <p className="op-hint">
              {c('sent.supportHidden', lang)}
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
  // Every screen that shows something to read gets a read-aloud button. That now includes the
  // language question (the FIRST screen — it used to be the one screen with no way to hear the
  // question) and the review screen (the last one).
  const showReadAloud = Boolean(step) && !isReview;

  // On a consent screen the question alone ("Confirmation") says nothing — read the body too.
  // Simple words change the intro too, not just the question: the first screen is where a person
  // decides whether this form is for them, so it is the worst place to fall back to a long sentence.
  const introText = () => (settings.simple && schema.introSimple ? schema.introSimple : schema.intro);

  const readAloudText = (st: Step): string => {
    // The intro used to be left out of this. It is the one paragraph that tells a person they
    // can get help and that there is no time limit — nothing that only appears on the first
    // screen should be the one thing that is never spoken.
    // Structured contract: 1. Question title -> 2. Intro (if first step) -> 3. Why & Hint & Body
    // -> 4. Optional marker -> 5. Choices/Options. Nothing left out across any question type.
    const parts: string[] = [questionText(st, lang, settings.simple)];
    if (index === 0 && schema.intro) parts.push(t(introText(), lang));
    if (st.why) parts.push(whyText(st, lang, settings.simple));
    if (st.hint) parts.push(hintText(st, lang, settings.simple));
    if (st.body) parts.push(bodyText(st, lang, settings.simple));
    if (st.optional) parts.push(t(schema.ui?.optional, lang));
    if (st.options && st.options.length > 0) {
      for (const o of st.options) parts.push(optionText(o, lang, settings.simple));
    }
    return parts.filter(Boolean).join(' ');
  };
  const progress = tpl(t(schema.ui?.stepOf, lang), { n: index + 1, step: index + 1, total: steps.length });

  return (
    <div className="op-shell" data-big={settings.big || undefined} data-embed={isEmbed || undefined}>
      <a className="op-skip" href="#op-main">
        {c('nav.skip', lang)}
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

      {/* data-step-type lets a test assert on what a screen IS, not on guessing from its text */}
      <main className="op-root" id="op-main" tabIndex={-1} data-step-type={step?.type ?? 'done'}>
        {!online && !f.submitted && (
          <div className="op-net">
            <Icon name="alert" />
            <p>
              <strong>{c('offline.title', lang)}</strong>{' '}
              {c('offline.body', lang)}
              {smsSent && (
                <span> {c('offline.smsSent', lang)}</span>
              )}
            </p>
          </div>
        )}

        {receipt && !f.submitted && (
          <div className="op-banner" role="status">
            <p>
              {c('banner.lastSent', lang)}
              <span className="op-mono op-ref">{receipt.id}</span>
            </p>
            <button type="button" className="op-btn" onClick={() => { outbox.clearReceipts(); setReceipt(null); }}>
              {c('banner.dismiss', lang)}
            </button>
          </div>
        )}

        {f.restored && (
          <div className="op-banner" role="status">
            <p>{c('resume.title', lang)}</p>
            <button type="button" className="op-btn" onClick={() => f.discardDraft()}>
              {c('resume.startAgain', lang)}
            </button>
          </div>
        )}

        <ErrorSummary
          ref={summary}
          items={errorList}
          lang={lang}
          schema={schema}
          onJump={(id) => {
            f.goTo(id);
            const el = document.getElementById(id) || document.querySelector<HTMLElement>(`[name="${id}"]`);
            el?.focus();
          }}
        />

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
                  postToParent('submitted', { id: mine.id, reference: entry.ref, formId: schema.id });
                } else if (left) {
                  setSend({ state: 'queued', ref: entry.ref, attempts: left.attempts,
                            reason: left.lastError === 'rejected' ? 'unreachable' : 'offline' });
                  postToParent('queued', { reference: entry.ref, reason: left.lastError, formId: schema.id });
                }
              });
            } else f.next();
          }}
        >
          <h1 ref={h1} tabIndex={-1} className="op-h1" id="op-q-title">
            {step.icon && !isReview && !isSubmit && <Icon name={step.icon} />}
            {isReview ? t(step.label, lang) : questionText(step, lang, settings.simple)}
          </h1>

          {index === 0 && schema.intro && <p className="op-intro">{t(introText(), lang)}</p>}

          {isReview ? (
            <>
              <ReadAloudButton
                text={reviewText(
                  steps, values, lang, settings.simple,
                  c('review.intro', lang),
                  c('review.nextHint', lang),
                )}
                lang={lang}
                schema={schema}
              />
              <ReviewScreen steps={steps} values={values} lang={lang} simple={settings.simple} schema={schema} onEdit={f.goTo} />
            </>
          ) : (
            <>
              {showReadAloud && (
                <ReadAloudButton
                  step={step}
                  simple={settings.simple}
                  text={readAloudText(step)}
                  lang={lang}
                  schema={schema}
                />
              )}
              <Field
                headingId="op-q-title"
                step={step} schema={schema} lang={lang} simple={settings.simple}
                value={appliedValue(step)} errorRule={errors[step.id]}
                onChange={(v) => handleChange(step, v)}
              />
            </>
          )}

          <div className="op-nav">
            {index > 0 && (
              <button type="button" className="op-btn op-btn-back" onClick={f.back}>
                <span aria-hidden="true">← </span>{t(schema.ui?.back, lang)}
              </button>
            )}
            <button type="submit" className="op-btn op-btn-primary">
              {isSubmit ? t(step.submitLabel, lang) : t(schema.ui?.next, lang)}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
