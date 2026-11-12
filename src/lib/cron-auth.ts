import crypto from 'crypto';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Constant-time string comparison. Both sides are hashed first so the
 * buffers always have the same length (timingSafeEqual throws otherwise)
 * and the secret's length does not leak through timing.
 */
function safeEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

/**
 * Verify that a cron request carries `Authorization: Bearer <CRON_SECRET>`.
 * Use this at the start of all cron route handlers.
 *
 * Vercel Cron sends that header automatically when the CRON_SECRET env var
 * is set on the project — it is the ONLY accepted proof. The former
 * `x-vercel-cron: 1` shortcut was removed: the header is a plain request
 * header any client can send, so it authenticated nobody.
 *
 * Fail-closed: no CRON_SECRET configured → every request is refused.
 */
export async function verifyCronRequest(): Promise<boolean> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (!authHeader) {
    return false;
  }

  return safeEqual(authHeader, `Bearer ${secret}`);
}
