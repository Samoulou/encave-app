import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Verify that a request is from Vercel Cron or has valid CRON_SECRET
 * Use this at the start of all cron route handlers
 */
export async function verifyCronRequest(): Promise<boolean> {
  const headersList = await headers();

  // Check for Vercel's automatic cron header (production)
  const vercelCron = headersList.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  // Check for CRON_SECRET in authorization header (for local testing)
  const authHeader = headersList.get('authorization');
  if (env.CRON_SECRET && authHeader === `Bearer ${env.CRON_SECRET}`) {
    return true;
  }

  return false;
}
