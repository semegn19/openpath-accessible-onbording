import { useEffect, useRef, useState } from 'react';
import { t, tpl } from './i18n';
import type { Lang, Schema, Step } from './types';

import { c } from './copy';
import { Icon } from './icons';
import { spokenToDigits } from './digits';
import { playRecorded, playQuestionAudio, stopAudio, isAudioPlaying } from './audio';

/** Speak one string with the browser. Amharic only if a matching voice exists — otherwise say so. */
export function speak(text: string, lang: Lang) {
  stopAudio();
  if (!('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  const want = lang === 'am' ? 'am' : lang === 'om' ? 'om' : lang === 'ti' ? 'ti' : 'en';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(want));
  if (!voice) return false;
  u.voice = voice;
  u.lang = voice.lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

export function ReadAloudButton({
  text,
  lang,
  schema,
  step,
  simple,
}: {
  text: string;
  lang: Lang;
  schema: Schema;
  step?: Step;
  simple?: boolean;
}) {
  const [msg, setMsg] = useState('');
  const label = t(schema.ui?.readAloud, lang);
  return (
    <div className="op-readaloud">
      <button
        type="button"
        className="op-btn op-btn-quiet"
        onClick={async () => {
          setMsg('');
          if (isAudioPlaying()) {
            stopAudio();
            return;
          }
          // 1. A pre-recorded human audio clip (works offline, on any phone)
          if (
            step &&
            (await playQuestionAudio({
              stepId: step.id,
              formId: schema.id,
              lang,
              simple,
              text,
              audioProp: step.audio,
            }))
          ) {
            return;
          }
          if (await playRecorded(lang, text)) return;
          // 2. The device's own voice fallback, if it has one for this language
          const ok = speak(text, lang);
          setMsg(ok ? '' : c('voice.noVoice', lang));
        }}
      >
        <Icon name="speaker" />{label}
      </button>
      {msg && <p className="op-hint" role="status">{msg}</p>}
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * VoiceField: ONE wrapper for every field. Never writes a transcript into the form without an
 * explicit press.
 *
 * Two things it must never do:
 *  - fill a consent box (a transcribed consent is not consent) — the caller never mounts it there;
 *  - fail silently on a choice. Saying "quiet room" and having the card close with nothing ticked
 *    is the worst possible outcome on the lowest-confidence input path.
 */
export type Choice = { value: string; label: string; aliases?: string[] };

/** Is this deployment configured with a speech engine? Asked once, cached, and only when needed. */
let asrAvailable: Promise<{ configured: boolean; langs: string[] | null }> | null = null;
/** What the last probe found: null = not asked yet. Lets the message say why no engine answered. */
let asrKnown: boolean | null = null;
let asrLangs: string[] | null = null;
const canTranscribeOnServer = async (lang?: Lang): Promise<boolean> => {
  if (!asrAvailable) {
    asrAvailable = fetch('/api/health')
      .then((r) => (r.ok ? r.json() : {}))
      .then((h: { transcription?: string; transcriptionLanguages?: string[] }) => {
        asrKnown = h.transcription === 'configured';
        asrLangs = Array.isArray(h.transcriptionLanguages) ? h.transcriptionLanguages : null;
        return { configured: asrKnown, langs: asrLangs };
      })
      .catch(() => {
        asrKnown = false;
        asrLangs = null;
        return { configured: false, langs: null };
      });
  }
  const info = await asrAvailable;
  if (!info.configured) return false;
  if (lang && info.langs && !info.langs.includes(lang)) return false;
  return true;
};

const pickMime = (): string => {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  return opts.find((m) => MR?.isTypeSupported?.(m)) ?? '';
};

/** Record, upload, get text. The audio is never stored anywhere — server or client. */
let stopRecording: (() => void) | null = null;

/** True while a recording is running, so the button can act as "I have finished". */
export const isRecording = () => Boolean(stopRecording);
export const finishRecording = () => { stopRecording?.(); };

async function recordAndTranscribe(lang: Lang = 'am', maxMs = 15_000): Promise<{ text?: string; error?: string }> {
  const md = navigator.mediaDevices as MediaDevices | undefined;
  if (!md?.getUserMedia) return { error: 'not-allowed' };
  let stream: MediaStream;
  try { stream = await md.getUserMedia({ audio: true }); } catch { return { error: 'not-allowed' }; }
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR) { stream.getTracks().forEach((t) => t.stop()); return { error: 'unsupported' }; }
  try {
    const rec = new MR(stream, pickMime() ? { mimeType: pickMime() } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    rec.start();
    // The person decides when they have finished — a fixed window either cuts them off mid-word
    // or makes them wait. The timeout is only a backstop for a forgotten tab.
    stopRecording = () => { try { rec.stop(); } catch { /* already stopped */ } };
    await Promise.race([done, new Promise((r) => setTimeout(r, maxMs))]);
    stopRecording = null;
    try { rec.stop(); } catch { /* may already be stopped */ }
    await done;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
    const res = await fetch(`/api/transcribe?lang=${encodeURIComponent(lang)}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type, 'X-Language': lang },
      body: blob,
    });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: { code?: string } };
    if (res.ok && data.text) return { text: data.text };
    return { error: data.error?.code ?? `http-${res.status}` };
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return { error: 'unknown' };
  }
}

const norm = (s: string): string =>
  s.toLowerCase().replace(/[.,!?።፣፤፦፧"'፠]/g, ' ').replace(/\s+/g, ' ').trim();

/** Best matching option, or null. Exact beats contained; Amharic and English labels both count. */
export function matchChoice(choices: Choice[], said: string): Choice | null {
  const t2 = norm(said);
  if (!t2) return null;
  const candidates = choices.map((c) => ({ c, keys: [c.label, c.value, ...(c.aliases ?? [])].map(norm).filter(Boolean) }));
  for (const { c, keys } of candidates) {
    if (keys.some((k) => k === t2)) return c;
  }
  for (const { c, keys } of candidates) {
    if (keys.some((k) => k.length > 2 && (t2.includes(k) || k.includes(t2)))) return c;
  }
  return null;
}

export function VoiceButton({ lang, schema, fieldType, choices, tryLangs, onAccept, onPick }: {
  lang: Lang;
  schema: Schema;
  fieldType?: string;
  choices?: Choice[];
  /** Recognition languages to try in order — on the language screen, both. */
  tryLangs?: Lang[];
  onAccept: (text: string) => void;
  onPick?: (value: string) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'recording' | 'transcribing' | 'review' | 'nomatch' | 'unsupported' | 'unavailable'>('idle');
  const [heard, setHeard] = useState('');
  const [matched, setMatched] = useState<Choice | null>(null);
  const [why, setWhy] = useState<{ code: string; lang: Lang } | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => { try { rec.current?.stop(); } catch { /* noop */ } }, []);

  const ui = schema.ui;
  const speakLabel = t(ui?.speak, lang);
  const order = tryLangs?.length ? tryLangs : [lang];

  const handleTranscript = (said: string) => {
    setHeard(said);
    if (!choices?.length) { setPhase('review'); return; }
    const hit = matchChoice(choices, said);
    if (hit) { setMatched(hit); setPhase('review'); }
    else setPhase('nomatch');
  };

  /** The server engine: used when the browser has none, or has none for this language. */
  const useServer = async (cause = 'language-not-supported', targetLang: Lang = order[0] ?? lang) => {
    if (!(await canTranscribeOnServer(targetLang))) {
      // Report what the browser actually said, not a generic "no model" — a blocked microphone and
      // an unreachable speech service need different fixes.
      setWhy({ code: cause, lang: targetLang });
      setPhase('unavailable');
      return;
    }
    setPhase('recording');
    const out = await recordAndTranscribe(targetLang);
    if (out.text) { handleTranscript(out.text); return; }
    setWhy({ code: out.error ?? 'unknown', lang: targetLang });
    setPhase('unavailable');
  };

  const listen = (i: number) => {
    const r = getRecognition();
    const attempt = order[i] ?? null;
    if (!r) { void useServer('language-not-supported', attempt ?? order[0] ?? lang); return; }  // Firefox/Safari: no browser engine at all
    if (!attempt) { setWhy({ code: 'language-not-supported', lang: order[0] }); setPhase('unavailable'); return; }

    rec.current = r;
    r.lang = attempt === 'am' ? 'am-ET' : attempt === 'om' ? 'om-ET' : attempt === 'ti' ? 'ti-ET' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 3;

    r.onresult = (e) => {
      const alternatives = (e.results?.[0] ?? []) as ArrayLike<{ transcript: string }>;
      const said = Array.from({ length: alternatives.length }, (_, k) => alternatives[k]?.transcript ?? '').filter(Boolean);
      // Try every alternative the engine offered before deciding we did not understand.
      handleTranscript(said.find((x) => !choices?.length || matchChoice(choices, x)) ?? said[0] ?? '');
    };
    // Chrome reports `language-not-supported` for languages it has no model for (Amharic is one).
    // Try the next language in the list rather than dying, then say exactly what happened.
    r.onerror = (ev) => {
      const code = (ev as { error?: string })?.error ?? 'unknown';
      if (['language-not-supported', 'network', 'service-not-allowed', 'audio-capture'].includes(code) && i + 1 < order.length) {
        try { r.stop(); } catch { /* noop */ }
        listen(i + 1);
        return;
      }
      // The browser cannot do this language (Amharic, always) or has no model at all: hand the
      // job to the server engine if this deployment has one. Nothing is sent unless it is
      // configured — `canTranscribeOnServer()` asks /api/health first.
      if (['language-not-supported', 'service-not-allowed', 'network'].includes(code)) {
        void useServer(code, attempt);
        return;
      }
      setWhy({ code, lang: attempt });
      setPhase(code === 'no-speech' || code === 'aborted' ? 'idle' : 'unavailable');
    };
    r.onend = () => setPhase((p) => (p === 'listening' ? 'idle' : p));
    setPhase('listening');
    try { r.start(); } catch { listen(i + 1); }
  };

  if (phase === 'unsupported') {
    return (
      <p className="op-hint" role="status">
        {c('voice.unsupported', lang)}
      </p>
    );
  }

  if (phase === 'unavailable') {
    // A message that names the cause. "Not available" with no reason is what sent us looking in
    // the wrong place: on a desktop Chrome the problem is usually the page, not the language.
    const code = why?.code ?? 'unknown';
    const names = order.map((l) => c(l === 'am' ? 'voice.nameAm' : 'voice.nameEn', lang));
    const which = names.length > 1 ? names.join(c('voice.or', lang)) : names[0];
    const insecure = typeof window !== 'undefined' && !window.isSecureContext;
    const framed = typeof window !== 'undefined' && window.top !== window.self;

    // One key per cause: written once, translated once. The language names it could not hear
    // arrive as {langs}, because that clause has a different shape in each language.
    const msgKey: Record<string, string> = {
      'not-allowed': insecure ? 'voice.err.insecure' : framed ? 'voice.err.framed' : 'voice.err.blocked',
      'service-not-allowed': 'voice.err.service',
      network: 'voice.err.network',
      'audio-capture': 'voice.err.noMic',
      'language-not-supported': 'voice.err.noModel',
      unknown: 'voice.err.unknown',
    };
    const detail = tpl(c(msgKey[code] ?? 'voice.err.unknown', lang), { langs: which });
    const tail = c('voice.buttonsOrType', lang);
    // If we tried the server too and it has no engine, say that — otherwise a person cannot tell
    // "this browser cannot" from "this deployment cannot".
    const noEngine = asrKnown === false
      ? (c('voice.noEngine', lang))
      : '';
    return (
      <p className="op-hint" role="status" data-stt-error={code}>
        {detail}{noEngine} {tail}
      </p>
    );
  }

  if (phase === 'recording' || phase === 'transcribing') {
    return (
      <div className="op-voice-card" role="status">
        <p className="op-voice-heard">
          {phase === 'recording'
            ? (c('voice.recording', lang))
            : (c('voice.transcribing', lang))}
        </p>
        {phase === 'recording' && (
          <button type="button" className="op-btn op-btn-primary" onClick={() => finishRecording()}>
            {c('voice.finished', lang)}
          </button>
        )}
        {/* Say what is happening to the recording. A person who cannot read is still owed this. */}
        <p className="op-hint">
          {c('voice.privacy', lang)}
        </p>
      </div>
    );
  }

  if (phase === 'nomatch') {
    return (
      <div className="op-voice-card" role="status">
        <p className="op-voice-heard">
          <strong>{t(ui?.weHeard, lang)}</strong> {heard || '—'}
        </p>
        <p className="op-hint">
          {c('voice.pickOne', lang)}
        </p>
        <div className="op-row">
          {(choices ?? []).map((c) => (
            <button key={c.value} type="button" className="op-btn" onClick={() => { onPick?.(c.value); setPhase('idle'); }}>
              {c.label}
            </button>
          ))}
        </div>
        <button type="button" className="op-btn op-btn-quiet" onClick={() => { setHeard(''); listen(0); }}>
          {t(ui?.retry, lang)}
        </button>
      </div>
    );
  }

  if (phase === 'review') {
    const isChoice = Boolean(choices?.length) && matched;
    // A phone read out loud arrives as words ("ዘጠኝ አንድ አንድ"), not digits. Convert, and
    // show BOTH what we heard and what will be used — never silently rewrite an answer.
    let usable = fieldType === 'tel' || fieldType === 'number' ? spokenToDigits(heard, lang) : heard;
    if ((fieldType === 'tel' || fieldType === 'number') && usable === heard.trim()) {
      usable = spokenToDigits(heard, lang === 'am' ? 'en' : 'am');
    }
    const changed = usable !== heard.trim();
    return (
      <div className="op-voice-card">
        <p className="op-voice-heard"><strong>{t(ui?.weHeard, lang)}</strong> {heard}</p>
        {isChoice ? (
          <p className="op-voice-heard">
            <strong>{c('voice.weWillUse', lang)}</strong> {matched?.label}
          </p>
        ) : changed && (
          <p className="op-voice-heard"><strong>{c('voice.weWillUse', lang)}</strong> {usable}</p>
        )}
        <div className="op-row">
          <button
            type="button"
            className="op-btn op-btn-primary"
            onClick={() => {
              if (isChoice && matched) onPick?.(matched.value);
              else onAccept(usable);
              setPhase('idle');
            }}
          >
            {t(ui?.accept, lang)}
          </button>
          <button type="button" className="op-btn" onClick={() => { setHeard(''); listen(0); }}>
            {t(ui?.retry, lang)}
          </button>
          <button type="button" className="op-btn" onClick={() => setPhase('idle')}>
            {isChoice
              ? (c('voice.chooseWithButtons', lang))
              : t(ui?.typeInstead, lang)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="op-btn op-btn-voice"
      onClick={() => listen(0)}
      aria-pressed={phase === 'listening'}
      data-stt={choices?.length ? 'choice' : 'text'}
    >
      <Icon name="mic" />
      {phase === 'listening' ? (c('voice.listening', lang)) : speakLabel}
    </button>
  );
}
