/**
 * Offline scan queue (P-13 / L-140, D2). Pure module — no React, no
 * network: persistence goes through an injected Storage-like object so
 * unit tests run without a browser, and the flush strategy is a plain
 * function fed by an injected submitter.
 *
 * Lifecycle: a scan matched locally while offline is enqueued; when the
 * network returns, flushQueue() replays each item through the
 * (idempotent) checkInBooking action. ALREADY_CHECKED_IN counts as
 * synced — the double-scan already happened, the seat is checked in.
 */

export interface QueuedScan {
  bookingId: string;
  /** ISO timestamp of the local scan (audit/debug only). */
  scannedAt: string;
}

export interface ScanQueueStorage {
  getItem(_key: string): string | null;
  setItem(_key: string, _value: string): void;
  removeItem(_key: string): void;
}

/**
 * Storage key scoped by user id: a shared device (two winemaker
 * accounts on one tablet) must never replay one account's queue under
 * the other's session — ownership would reject and silently drop them.
 */
export function scanQueueKey(scope: string): string {
  return `encave.scan-queue.v1.${scope}`;
}

export function loadQueue(
  storage: ScanQueueStorage,
  key: string
): QueuedScan[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedScan =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as QueuedScan).bookingId === 'string' &&
        typeof (item as QueuedScan).scannedAt === 'string'
    );
  } catch {
    // Corrupted storage — start clean rather than crash the scanner.
    return [];
  }
}

export function saveQueue(
  storage: ScanQueueStorage,
  key: string,
  queue: QueuedScan[]
): void {
  try {
    if (queue.length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(queue));
    }
  } catch {
    // Quota/private-mode failure: the in-memory queue still flushes this
    // session; only crash-recovery is lost.
  }
}

/** Enqueue with dedupe — a double-scan must not sync twice. */
export function enqueueScan(
  queue: QueuedScan[],
  bookingId: string,
  scannedAt: Date
): QueuedScan[] {
  if (queue.some((item) => item.bookingId === bookingId)) return queue;
  return [...queue, { bookingId, scannedAt: scannedAt.toISOString() }];
}

/**
 * Submitter outcome, mapped from the checkInBooking ActionResult:
 * - 'synced'    — CHECKED_IN, or ALREADY_CHECKED_IN (both sides agree)
 * - 'rejected'  — definitive server refusal (cancelled, wrong day,
 *                 not found…): retrying will never succeed, drop it
 * - 'retry'     — transient failure (network, rate limit, 5xx): keep
 */
export type ScanSubmitOutcome = 'synced' | 'rejected' | 'retry';

export interface FlushResult {
  remaining: QueuedScan[];
  syncedIds: string[];
  rejectedIds: string[];
}

/**
 * Replay the queue sequentially (order preserved, no thundering herd on
 * a flaky connection). Stops early on the first 'retry' outcome — if the
 * network just dropped again, hammering the rest is pointless.
 */
export async function flushQueue(
  queue: QueuedScan[],
  submit: (_item: QueuedScan) => Promise<ScanSubmitOutcome>
): Promise<FlushResult> {
  const remaining: QueuedScan[] = [];
  const syncedIds: string[] = [];
  const rejectedIds: string[] = [];

  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    if (!item) continue;

    let outcome: ScanSubmitOutcome;
    try {
      outcome = await submit(item);
    } catch {
      outcome = 'retry';
    }

    if (outcome === 'synced') {
      syncedIds.push(item.bookingId);
    } else if (outcome === 'rejected') {
      rejectedIds.push(item.bookingId);
    } else {
      // Keep this one and everything after it for the next flush.
      remaining.push(...queue.slice(index));
      break;
    }
  }

  return { remaining, syncedIds, rejectedIds };
}
