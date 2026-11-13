/**
 * The outbox: a sign-up that could not be sent is kept on the device, retried, and never
 * duplicated.
 *
 * Why this file exists. The form used to delete the saved draft and *then* start the POST. On a
 * dropped connection that meant the screen said "your answers are saved on this device" about
 * answers that had already been deleted. The user closed the tab and lost the sign-up. In a
 * country where a phone loses signal mid-form routinely, that is the difference between a form
 * that works and a form that quietly eats people's work.
 *
 * Rules:
 *  - Write to the device FIRST, send second. Never the other way round.
 *  - Every attempt carries the same `ref`, so a retry after a lost response cannot create a
 *    second record. The server dedupes on it (see api/server.mjs).
 *  - Once sent, the answers are deleted from the device. Only the reference number is kept —
 *    the user needs it, the names and phone numbers nobody needs twice.
 */

export type Queued = {
  ref: string;                                  // idempotency key, generated once
  formId: string;
  answers: Record<string, unknown>;             // exactly the payload that will be sent
  queuedAt: number;                             // ms epoch
  attempts: number;
  lastError?: string;
};

export type Receipt = { ref: string; formId: string; id: string; receivedAt: string; sentAt: number };

const OUTBOX = 'openpath:outbox:v1';            // Queued[]
const RECEIPTS = 'openpath:receipts:v1';        // Receipt[] — reference numbers only

/** A random, opaque id. Not crypto-strength security, just uniqueness — so no crypto.randomUUID
 *  (missing on old Android WebViews over plain http, which is exactly the target phone). */
export const newRef = (): string =>
  `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;    // quota / private mode: the caller must not pretend it was saved
  }
};

export const list = (formId?: string): Queued[] => {
  const all = read<Queued[]>(OUTBOX, []);
  return (Array.isArray(all) ? all : []).filter((q) => q?.ref && (!formId || q.formId === formId));
};

export const receipts = (formId?: string): Receipt[] => {
  const all = read<Receipt[]>(RECEIPTS, []);
  return (Array.isArray(all) ? all : []).filter((r) => r?.id && (!formId || r.formId === formId));
};

export const lastReceipt = (formId: string): Receipt | undefined =>
  receipts(formId).sort((a, b) => b.sentAt - a.sentAt)[0];

/** Durably queue an answer set. Returns the entry, or null when the device refuses to store it —
 *  the caller must then say so instead of claiming it is safe. */
export function enqueue(formId: string, answers: Record<string, unknown>): Queued | null {
  const entry: Queued = { ref: newRef(), formId, answers, queuedAt: Date.now(), attempts: 0 };
  return write(OUTBOX, [...list(), entry]) ? entry : null;
}

export function update(ref: string, patch: Partial<Queued>): void {
  write(OUTBOX, list().map((q) => (q.ref === ref ? { ...q, ...patch } : q)));
}

export function remove(ref: string): void {
  write(OUTBOX, list().filter((q) => q.ref !== ref));
}

export function recordReceipt(entry: Queued, id: string, receivedAt: string): void {
  // Keep the number, drop the names. Data minimisation, not a footnote.
  write(RECEIPTS, [
    ...receipts().filter((r) => r.ref !== entry.ref),
    { ref: entry.ref, formId: entry.formId, id, receivedAt, sentAt: Date.now() },
  ].slice(-10));
  remove(entry.ref);
}

/** The user has the number written down (or not) — their call, not ours to nag about. */
export const clearReceipts = (): void => { write(RECEIPTS, []); };

/** True when this device has something waiting to go out. */
export const pending = (formId?: string): number => list(formId).length;
