import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { reconcileGiftTransfers } from '@/server/services/giftCard-transfer.service';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Retries platform→winery gift transfers that never landed (P-09, Luca
 * §5/§8). NOT gated by the GIFT_CARDS flag: the kill-switch stops NEW gift
 * purchases and redemptions, never money already owed — a winery whose
 * guest paid with a gift before the switch was flipped must still be paid.
 * With the flag OFF and nothing pending the sweep is one indexed query.
 * Idempotent (settleGiftTransfer guards on giftTransferId).
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
