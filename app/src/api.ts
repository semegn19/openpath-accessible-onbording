/** Talking to the API. Written so that "no API" is a normal outcome, not an error:
 *  the same bundle is deployed as plain static files (Level 1) and behind the API (Level 2).
 *
 *  Nothing here ever throws. A dropped connection is the expected case on the target phone, so
 *  it is a returned value — `unreachable` — that the outbox can act on, not an exception. */

import { list as listQueue, recordReceipt, update, type Queued } from './outbox';

export type SendState =
  | { state: 'sending' }
  | { state: 'sent'; id: string; receivedAt?: string; stripped: string[] }
  | { state: 'queued'; ref: string; attempts: number; reason: 'offline' | 'unreachable' | 'full' }
  | { state: 'rejected'; detail: string };

/** What a single POST came back with. `unreachable` is not a failure of the answers. */
export type SendResult =
  | { state: 'sent'; id: string; receivedAt?: string; stripped: string[] }
  | { state: 'rejected'; detail: string }
  | { state: 'unreachable'; reason: 'offline' | 'timeout' | 'no-api' | 'server' };

type Receipt = { id: string; receivedAt: string; stripped?: string[] };
type FieldError = { error?: { fields?: { field: string; rule: string }[] } };

/** 10 s: a 3G uplink with 400 ms RTT genuinely takes that long for a small JSON body, and
 *  timing out early turns a slow success into a confusing "we will send it later". */
const DEFAULT_TIMEOUT = 10_000;

export async function postSubmission(
  formId: string,
  answers: Record<string, unknown>,
  opts: { clientRef?: string; timeoutMs?: number } = {},
): Promise<SendResult> {
  // Cheap and local: no point waiting 10 s to learn what the OS already knows.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { state: 'unreachable', reason: 'offline' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId, answers, clientRef: opts.clientRef }),
      signal: ctrl.signal,
    });

    // A static host with no API answers with HTML (or 404). Do not try to read JSON from it.
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return { state: 'unreachable', reason: 'no-api' };

    const data = (await res.json()) as Partial<Receipt> & FieldError;

    // 201 = stored now. 200 = we have seen this clientRef before; the answer is the same
    // record, so a retry after a lost response cannot double-register anybody.
    if ((res.status === 201 || res.status === 200) && data.id) {
      return { state: 'sent', id: data.id, receivedAt: data.receivedAt, stripped: data.stripped ?? [] };
    }
    if (res.status === 422 && data.error?.fields) {
      return { state: 'rejected', detail: data.error.fields.map((f) => `${f.field}: ${f.rule}`).join(', ') };
    }
    if (res.status === 429) return { state: 'unreachable', reason: 'server' };
    return { state: 'unreachable', reason: 'server' };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    return { state: 'unreachable', reason: aborted ? 'timeout' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

export type FlushResult = {
  sent: { ref: string; id: string; receivedAt?: string; stripped: string[] }[];
  still: Queued[];
};

/** Try to send everything waiting on this device. Safe to call as often as you like:
 *  concurrent calls share one run, and a success removes the entry before the next attempt. */
let inFlight: Promise<FlushResult> | null = null;

export function flush(entries: Queued[] = []): Promise<FlushResult> {
  if (inFlight) return inFlight;
  const run = async () => {
    const sent: FlushResult['sent'] = [];
    const still: Queued[] = [];
    const queue = entries.length ? entries : listQueue();
    for (const entry of queue) {
      const r = await postSubmission(entry.formId, entry.answers, { clientRef: entry.ref });
      if (r.state === 'sent') {
        recordReceipt(entry, r.id, r.receivedAt ?? new Date().toISOString());
        sent.push({ ref: entry.ref, id: r.id, receivedAt: r.receivedAt, stripped: r.stripped });
      } else if (r.state === 'rejected') {
        // Deterministic: retrying will not help. Keep the answers, park the entry, tell the user.
        update(entry.ref, { attempts: entry.attempts + 1, lastError: r.detail });
        still.push({ ...entry, attempts: entry.attempts + 1, lastError: r.detail });
      } else {
        update(entry.ref, { attempts: entry.attempts + 1, lastError: r.reason });
        still.push({ ...entry, attempts: entry.attempts + 1, lastError: r.reason });
      }
    }
    return { sent, still };
  };
  inFlight = run().finally(() => { inFlight = null; });
  return inFlight;
}
