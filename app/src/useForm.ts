import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Errors, Lang, Schema, Step, Values } from './types';
import { firstFailure, normalizePhoneET } from './validation';

export interface Settings {
  lang: Lang;
  simple: boolean;
  big: boolean;
  readAloud: boolean;
}

const draftKey = (id: string) => `openpath:draft:${id}`;

export function visibleSteps(schema: Schema, values: Values): Step[] {
  return schema.steps.filter((s) => {
    if (!s.showIf) return true;
    // Several conditions = all of them. A step that depends on two answers cannot be expressed
    // with one, and the failure mode of getting that wrong is asking a person the same question
    // twice (see `referral` in the onboarding schema).
    const conds = Array.isArray(s.showIf) ? s.showIf : [s.showIf];
    return conds.every((c) => {
      const dep = values[c.step];
      return typeof dep === 'string' && c.in.includes(dep);
    });
  });
}

export function useForm(schema: Schema) {
  const [values, setValues] = useState<Values>(() => {
    const langStep = schema.steps.find((st) => st.type === 'language');
    return langStep ? { [langStep.id]: schema.defaultLang } : {};
  });
  const [errors, setErrors] = useState<Errors>({});
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const [restored, setRestored] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    lang: schema.defaultLang,
    simple: false,
    big: false,
    readAloud: false,
  });

  const steps = useMemo(() => visibleSteps(schema, values), [schema, values]);
  const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[safeIndex];

  // --- restore a draft once, then offer the banner (never auto-resume silently) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(schema.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as { values?: Values };
      if (draft.values && Object.keys(draft.values).length > 0) {
        setValues(draft.values);
        setRestored(true);
      }
    } catch {
      /* corrupt draft: ignore rather than crash */
    }
  }, [schema.id]);

  // --- autosave (500 ms debounce, local only) ---
  useEffect(() => {
    if (submitted) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(schema.id), JSON.stringify({ values, savedAt: Date.now() }));
      } catch {
        /* quota: never lose the form over it */
      }
    }, 500);
    return () => clearTimeout(id);
  }, [values, schema.id, submitted]);

  const setValue = useCallback((fieldId: string, next: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: next }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const copy = { ...prev };
      delete copy[fieldId];
      return copy;
    });
  }, []);

  const validateAt = useCallback(
    (s: Step): Errors => {
      let val = values[s.id];
      if (s.type === 'language' && (val === undefined || val === null || val === '')) {
        val = settings.lang || schema.defaultLang;
      }
      const failing = firstFailure(s, val);
      return failing ? { [s.id]: failing } : {};
    },
    [values, settings.lang, schema.defaultLang],
  );

  const next = useCallback((): boolean => {
    if (!step) return false;
    if (step.type === 'language' && (values[step.id] === undefined || values[step.id] === null || values[step.id] === '')) {
      setValue(step.id, settings.lang || schema.defaultLang);
    }
    const found = validateAt(step);
    if (Object.keys(found).length) {
      setErrors(found);
      return false;
    }
    setErrors({});
    setIndex((i) => Math.min(i + 1, steps.length - 1));
    return true;
  }, [step, steps.length, validateAt, values, settings.lang, schema.defaultLang, setValue]);

  const back = useCallback(() => {
    setErrors({});
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback(
    (stepId: string) => {
      const i = steps.findIndex((s) => s.id === stepId);
      if (i >= 0) {
        setErrors({});
        setIndex(i);
      }
    },
    [steps],
  );

  const submit = useCallback((): Values | null => {
    const allErrors: Errors = {};
    for (const s of steps) Object.assign(allErrors, validateAt(s));
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      return null;
    }
    // PRIVACY: localOnly fields never leave the browser. This one line is the claim on the slide.
    const payload: Values = {};
    for (const s of steps) {
      if (s.localOnly) continue;
      const v = values[s.id];
      if (v === undefined) continue;
      payload[s.id] = s.type === 'tel' ? normalizePhoneET(String(v)) ?? v : v;
    }
    // DELIBERATELY no localStorage.removeItem here any more.
    // The draft is the only copy of these answers until the outbox has them. Deleting it before
    // the POST (which is what this did) loses the sign-up on a dropped connection — and the
    // screen went on to say "your answers are saved on this device" about answers that were
    // already gone. The caller clears the draft with clearDraft() after `enqueue()` succeeded.
    setSubmitted(payload);
    return payload;
  }, [steps, values, validateAt]);

  /** Remove the saved draft but keep what is on screen. Used once the outbox holds the answers. */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(schema.id));
    } catch {
      /* ignore */
    }
  }, [schema.id]);

  /** Show the done screen for a payload we did not just build (a queued or already-sent sign-up). */
  const adoptSubmitted = useCallback((payload: Values) => setSubmitted(payload), []);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(schema.id));
    } catch {
      /* ignore */
    }
    setValues({});
    setRestored(false);
    setIndex(0);
  }, [schema.id]);

  const restoreCheckpoint = useCallback((restoredValues: Values, stepIdx?: number) => {
    setValues(restoredValues);
    setRestored(true);
    if (typeof stepIdx === 'number' && stepIdx >= 0) {
      setIndex(stepIdx);
    }
  }, []);

  const errorList = useMemo(
    () =>
      Object.entries(errors)
        .map(([id, rule]) => ({ step: steps.find((s) => s.id === id), rule }))
        .filter((x): x is { step: Step; rule: { rule: string; params?: Record<string, string | number> } } => Boolean(x.step)),
    [errors, steps],
  );

  return {
    values, setValue, errors, errorList, step, steps, index: safeIndex,
    next, back, goTo, submit, submitted, restored, setRestored, discardDraft,
    clearDraft, adoptSubmitted, restoreCheckpoint,
    settings, setSettings,
  };
}

/** Read-aloud: browser TTS. Cancels on any keypress (gate: sound off must not only be possible, it must be easy). */
export function useCancelSpeechOnKey(onCancel: () => void) {
  const cb = useRef(onCancel);
  cb.current = onCancel;
  useEffect(() => {
    const handler = () => cb.current();
    window.addEventListener('keydown', handler, { passive: true });
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
