import { useEffect, useRef, useState } from 'react';
import type { Lang } from './types';
import { t } from './i18n';
import type { Schema } from './types';

import { Icon } from './icons';
import { spokenToDigits } from './digits';

/** Speak one string with the browser. Amharic only if a matching voice exists — otherwise say so. */
export function speak(text: string, lang: Lang) {
  if (!('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  const want = lang === 'am' ? 'am' : 'en';
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(want));
  if (!voice) return false;
  u.voice = voice;
  u.lang = voice.lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

export function ReadAloudButton({ text, lang, schema }: { text: string; lang: Lang; schema: Schema }) {
  const [msg, setMsg] = useState('');
  const label = t(schema.ui?.readAloud, lang, lang === 'am' ? 'ጥያቄውን አንብብልኝ' : 'Read the question');
  return (
    <div className="op-readaloud">
      <button
        type="button"
        className="op-btn op-btn-quiet"
        onClick={() => {
          const ok = speak(text, lang);
          setMsg(ok ? '' : lang === 'am'
            ? 'ይህ መሣሪያ በድምጽ ማንበብ አይችልም። ጽሑፉ ከዚህ በታች አለ።'
            : 'This device cannot speak Amharic. The text is below.');
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
 * VoiceField: ONE wrapper for every field. Never writes a transcript into the form
 * without an explicit "That is right" press.
 */
export function VoiceButton({ lang, schema, fieldType, onAccept }: {
  lang: Lang; schema: Schema; fieldType?: string; onAccept: (text: string) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'review' | 'unsupported'>('idle');
  const [heard, setHeard] = useState('');
  const rec = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => { try { rec.current?.stop(); } catch { /* noop */ } }, []);

  const ui = schema.ui;
  const speakLabel = t(ui?.speak, lang, lang === 'am' ? 'በድምጽ መልስ' : 'Speak your answer');

  const start = () => {
    const r = getRecognition();
    if (!r) { setPhase('unsupported'); return; }
    rec.current = r;
    r.lang = lang === 'am' ? 'am-ET' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript ?? '';
      setHeard(said);
      setPhase('review');
    };
    r.onerror = () => setPhase('idle');
    r.onend = () => setPhase((p) => (p === 'listening' ? 'idle' : p));
    setPhase('listening');
    try { r.start(); } catch { setPhase('idle'); }
  };

  if (phase === 'unsupported') {
    return (
      <p className="op-hint" role="status">
        {lang === 'am'
          ? 'ድምጽ በዚህ አሳሽ አይሠራም። የስልኩን ማይክሮፎን ይጠቀሙ ወይም ይጻፉ።'
          : 'Voice does not work in this browser. Use your keyboard microphone, or type.'}
      </p>
    );
  }

  if (phase === 'review') {
    // A phone read out loud arrives as words ("ዘጠኝ አንድ አንድ"), not digits. Convert, and
    // show BOTH what we heard and what will be used — never silently rewrite an answer.
    let usable = fieldType === 'tel' || fieldType === 'number' ? spokenToDigits(heard, lang) : heard;
    // Someone with the app in English may still read the number out in Amharic (and vice versa).
    if ((fieldType === 'tel' || fieldType === 'number') && usable === heard.trim()) {
      usable = spokenToDigits(heard, lang === 'am' ? 'en' : 'am');
    }
    const changed = usable !== heard.trim();
    return (
      <div className="op-voice-card">
        <p className="op-voice-heard"><strong>{t(ui?.weHeard, lang, lang === 'am' ? 'የሰማነው፦' : 'We heard:')}</strong> {heard}</p>
        {changed && (
          <p className="op-voice-heard"><strong>{lang === 'am' ? 'የሚጻፈው፦' : 'We will use:'}</strong> {usable}</p>
        )}
        <div className="op-row">
          <button type="button" className="op-btn op-btn-primary" onClick={() => { onAccept(usable); setPhase('idle'); }}>
            {t(ui?.accept, lang, lang === 'am' ? 'ትክክል ነው' : 'That is right')}
          </button>
          <button type="button" className="op-btn" onClick={() => { setHeard(''); start(); }}>
            {t(ui?.retry, lang, lang === 'am' ? 'እንደገና ሞክር' : 'Try again')}
          </button>
          <button type="button" className="op-btn" onClick={() => setPhase('idle')}>
            {t(ui?.typeInstead, lang, lang === 'am' ? 'በፊደል መጻፍ' : 'Type instead')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="op-btn op-btn-voice" onClick={start} aria-pressed={phase === 'listening'}>
      <Icon name="mic" />
      {phase === 'listening' ? (lang === 'am' ? 'በማዳመጥ ላይ…' : 'Listening…') : speakLabel}
    </button>
  );
}
