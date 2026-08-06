import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { reconcileGiftTransfers } from '@/server/services/giftCard-transfer.service';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Retries platform→winery gift transfers that never landed (P-09, Luca
 * §5/§8). Flag-gated by GIFT_CARDS: OFF → nothing to reconcile. Idempotent
 * (settleGiftTransfer guards on giftTransferId).
 */
export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor(
      'encave-reconcile-gift-transfers',
      async () => {
        if (!(await isFlagEnabled('GIFT_CARDS'))) {
          return NextResponse.json({ skipped: 'flag_off', durationMs: 0 });
        }
        const stats = await reconcileGiftTransfers();
        logInfo('gift_transfer.reconcile', {
          action: 'reconcileGiftTransfersCron',
          ...stats,
        });
        return NextResponse.json({
          ...stats,
          durationMs: Date.now() - startedAt,
        });
      }
    );
  } catch (error) {
    logError('reconcile gift transfers cron failed', error, {
      action: 'reconcileGiftTransfersCron',
    });
    return NextResponse.json(
      { error: 'Cron failed', durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
