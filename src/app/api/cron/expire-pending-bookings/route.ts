import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { logError } from '@/lib/logger';
import { expirePendingPaymentBookings } from '@/server/services/booking-expiration.service';

export async function GET() {
  const authorized = await verifyCronRequest();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await expirePendingPaymentBookings();
    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startedAt,
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
