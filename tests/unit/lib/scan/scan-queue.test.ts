import { describe, it, expect, vi } from 'vitest';
import {
  loadQueue,
  saveQueue,
  enqueueScan,
  flushQueue,
  SCAN_QUEUE_STORAGE_KEY,
  type QueuedScan,
  type ScanQueueStorage,
} from '@/lib/scan/scan-queue';

function memoryStorage(initial?: Record<string, string>): ScanQueueStorage & {
  dump(): Record<string, string>;
} {
  const store = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    dump: () => Object.fromEntries(store),
  };
}

const AT = new Date('2026-07-10T10:00:00Z');

describe('loadQueue / saveQueue', () => {
  it('round-trips a queue through storage', () => {
    const storage = memoryStorage();
    const queue = enqueueScan([], 'bk_1', AT);
    saveQueue(storage, queue);

    expect(loadQueue(storage)).toEqual([
      { bookingId: 'bk_1', scannedAt: AT.toISOString() },
    ]);
  });

  it('an empty queue removes the storage key entirely', () => {
    const storage = memoryStorage({ [SCAN_QUEUE_STORAGE_KEY]: '[]' });
    saveQueue(storage, []);
    expect(storage.dump()).toEqual({});
  });

  it('survives corrupted storage (returns empty, never throws)', () => {
    expect(
      loadQueue(memoryStorage({ [SCAN_QUEUE_STORAGE_KEY]: '{not json' }))
    ).toEqual([]);
    expect(
      loadQueue(memoryStorage({ [SCAN_QUEUE_STORAGE_KEY]: '{"a":1}' }))
    ).toEqual([]);
    expect(
      loadQueue(
        memoryStorage({ [SCAN_QUEUE_STORAGE_KEY]: '[{"bookingId":42}]' })
      )
    ).toEqual([]);
  });

  it('storage write failures are swallowed (private mode / quota)', () => {
    const storage: ScanQueueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(() => saveQueue(storage, enqueueScan([], 'bk_1', AT))).not.toThrow();
  });
});

describe('enqueueScan', () => {
  it('dedupes by bookingId — a double-scan never syncs twice', () => {
    const queue = enqueueScan([], 'bk_1', AT);
    const again = enqueueScan(queue, 'bk_1', new Date());
    expect(again).toBe(queue);
    expect(again).toHaveLength(1);
  });

  it('appends new bookings in scan order', () => {
    const queue = enqueueScan(enqueueScan([], 'bk_1', AT), 'bk_2', AT);
    expect(queue.map((item) => item.bookingId)).toEqual(['bk_1', 'bk_2']);
  });
});

describe('flushQueue', () => {
  const queue: QueuedScan[] = [
    { bookingId: 'bk_1', scannedAt: AT.toISOString() },
    { bookingId: 'bk_2', scannedAt: AT.toISOString() },
    { bookingId: 'bk_3', scannedAt: AT.toISOString() },
  ];

  it('drains a fully successful queue', async () => {
    const result = await flushQueue(queue, async () => 'synced');
    expect(result.remaining).toEqual([]);
    expect(result.syncedIds).toEqual(['bk_1', 'bk_2', 'bk_3']);
    expect(result.rejectedIds).toEqual([]);
  });

  it('counts ALREADY_CHECKED_IN-style outcomes as synced (idempotent)', async () => {
    const submit = vi
      .fn<[QueuedScan], Promise<'synced'>>()
      .mockResolvedValue('synced');
    const result = await flushQueue(queue.slice(0, 1), submit);
    expect(result.syncedIds).toEqual(['bk_1']);
  });

  it('drops definitively rejected items without retrying them', async () => {
    const result = await flushQueue(queue, async (item) =>
      item.bookingId === 'bk_2' ? 'rejected' : 'synced'
    );
    expect(result.remaining).toEqual([]);
    expect(result.syncedIds).toEqual(['bk_1', 'bk_3']);
    expect(result.rejectedIds).toEqual(['bk_2']);
  });

  it('stops at the first transient failure and keeps the tail', async () => {
    const submit = vi.fn(async (item: QueuedScan) =>
      item.bookingId === 'bk_2' ? ('retry' as const) : ('synced' as const)
    );
    const result = await flushQueue(queue, submit);

    expect(result.syncedIds).toEqual(['bk_1']);
    expect(result.remaining.map((item) => item.bookingId)).toEqual([
      'bk_2',
      'bk_3',
    ]);
    // bk_3 was NOT attempted — the network just failed.
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('treats a throwing submitter as transient (network drop mid-flush)', async () => {
    const result = await flushQueue(queue.slice(0, 2), async (item) => {
      if (item.bookingId === 'bk_1') throw new Error('offline again');
      return 'synced';
    });
    expect(result.remaining.map((item) => item.bookingId)).toEqual([
      'bk_1',
      'bk_2',
    ]);
    expect(result.syncedIds).toEqual([]);
  });
});
