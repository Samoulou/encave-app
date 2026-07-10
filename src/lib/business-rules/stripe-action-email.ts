import { differenceInHours } from 'date-fns';
import { hashToken } from '@/lib/utils/token';

/**
 * Anti-spam decision for email #18 « Action requise Stripe » (P-13 /
 * L-143). `account.updated` fires on every account touch — the email
 * must go out only when the requirements list actually CHANGED, or as a
 * single weekly re-reminder while it stays unresolved.
 */

export const STRIPE_ACTION_EMAIL_COOLDOWN_HOURS = 7 * 24;

/** Order-insensitive fingerprint of Stripe's currently_due list. */
export function computeStripeDueHash(currentlyDue: string[]): string {
  return hashToken([...currentlyDue].sort().join('|'));
}

export function shouldNotifyStripeAction(params: {
  currentlyDue: string[];
  storedHash: string | null;
  lastEmailAt: Date | null;
  now: Date;
}): boolean {
  const { currentlyDue, storedHash, lastEmailAt, now } = params;
  if (currentlyDue.length === 0) return false;
  if (computeStripeDueHash(currentlyDue) !== storedHash) return true;
  if (lastEmailAt === null) return true;
  return (
    differenceInHours(now, lastEmailAt) >= STRIPE_ACTION_EMAIL_COOLDOWN_HOURS
  );
}
