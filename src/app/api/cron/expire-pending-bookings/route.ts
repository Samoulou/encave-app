import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { logError } from '@/lib/logger';
import { expirePendingPaymentBookings } from '@/server/services/booking-expiration.service';

export const dynamic = 'force-dynamic';
// Per-booking Stripe round-trips — the default function timeout would
// truncate a busy night silently (review #120).
export const maxDuration = 300;

export async function GET() {
  const authorized = await verifyCronRequest();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-expire-pending-bookings', async () => {
      const result = await expirePendingPaymentBookings();
      // Per-item failures are swallowed by design (a bad booking must not
      // block the sweep) — but a run with failures must still alert:
      // the 200 + green check-in would otherwise hide it (review #120).
      if (result.failed > 0) {
        Sentry.captureMessage('expire-pending-bookings: failures in run', {
          level: 'warning',
          tags: { area: 'cron' },
          extra: { ...result },
        });
      }
      return NextResponse.json({
        ...result,
        durationMs: Date.now() - startedAt,
      });
    });
  } catch (error) {
    logError('expire pending bookings cron failed', error, {
      action: 'expirePendingPaymentBookingsCron',
    });
    return NextResponse.json(
      { error: 'Cron failed', durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
