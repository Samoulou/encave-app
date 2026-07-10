import { Prisma } from '@prisma/client';
import { logWarn } from '@/lib/logger';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

/**
 * Bounded retry around a Serializable transaction (L-209).
 * Two concurrent checkouts on the same slot make Postgres abort one
 * with a serialization conflict (P2034) — that loser must be retried
 * transparently, never surfaced to the client. Non-conflict errors
 * propagate immediately.
 */
export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      lastError = error;
      logWarn('Serialization conflict — retrying', {
        context,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
      });
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
