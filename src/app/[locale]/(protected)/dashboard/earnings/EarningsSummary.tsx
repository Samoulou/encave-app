import { EarningsSummaryCards } from '@/components/features/earnings/EarningsSummaryCards';
import { getEarningsSummary } from '@/server/queries/earnings.queries';
import { getNextPayout } from '@/server/queries/payouts.queries';
import { db } from '@/server/db';
import { logWarn } from '@/lib/logger';

interface EarningsSummaryProps {
  wineryId: string;
}

/**
 * Async server component for earnings summary cards.
 * Designed to stream first for fastest perceived loading.
 * The next-payout card reads REAL Stripe data (P-13 / L-141) and
 * degrades to «—» when the account is absent or the API fails —
 * never a date heuristic.
 */
export async function EarningsSummary({ wineryId }: EarningsSummaryProps) {
  const [summary, winery] = await Promise.all([
    getEarningsSummary(wineryId),
    db.winery.findUnique({
      where: { id: wineryId },
      select: { stripeAccountId: true },
    }),
  ]);

  let nextPayout = null;
  if (winery?.stripeAccountId) {
    try {
      nextPayout = await getNextPayout(winery.stripeAccountId);
    } catch (error) {
      logWarn('next payout fetch failed — card degrades', {
        action: 'EarningsSummary',
        wineryId,
        error: String(error),
      });
    }
  }

  return <EarningsSummaryCards summary={summary} nextPayout={nextPayout} />;
}
