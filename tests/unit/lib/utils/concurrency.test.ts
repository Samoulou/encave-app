import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/lib/utils/concurrency';

describe('mapWithConcurrency (P-16 / L-211)', () => {
  it('maps all items and preserves order', async () => {
    const result = await mapWithConcurrency([3, 1, 2], 2, async (n) => n * 10);
    expect(result).toEqual([30, 10, 20]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      () => {
        running++;
        peak = Math.max(peak, running);
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            running--;
            resolve();
          }, 5)
        );
      }
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it('propagates a rejection (callers catch inside fn)', async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
