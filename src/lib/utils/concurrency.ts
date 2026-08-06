/**
 * Bounded-concurrency map (P-16 / WS-F, L-211). The aggregate email crons
 * used to send strictly sequentially (slow at N wineries) — and a naive
 * Promise.all would hammer Resend/Stripe rate limits instead. No dependency:
 * a tiny worker-pool over the items array.
 *
 * Rejections propagate: callers that must survive per-item failures catch
 * INSIDE `fn` (the crons' per-winery try/catch pattern).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (_item: T, _index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        const item = items[index];
        if (item === undefined && index >= items.length) break;
        results[index] = await fn(item as T, index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
