import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIp,
  GEOCODE_RATE_LIMIT,
} from '@/server/services/rate-limit.service';

export const dynamic = 'force-dynamic';

/**
 * Client-scoped email opt-out (P-07 / decision A4, LCD compliance).
 * Linked from the footer of the « coups de cœur » recap. GET-safe: the
 * only effect is flipping marketingOptOut to true — idempotent, and a
 * mail scanner pre-opening the link simply opts the client out (the safe
 * failure mode for a commercial email).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Public endpoint rule: rate-limited (token enumeration / DB load).
    // 30/min per IP — same budget as the other public GET (geocode).
    const ip = getClientIp(request.headers);
    const rate = await checkRateLimit(
      `unsubscribe-client:${ip}`,
      GEOCODE_RATE_LIMIT
    );
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const preference = await db.clientEmailPreference.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, email: true },
    });
    if (!preference) {
      return NextResponse.redirect(
        new URL('/unsubscribe?status=invalid', request.url)
      );
    }

    await db.clientEmailPreference.update({
      where: { id: preference.id },
      data: { marketingOptOut: true },
    });
    logInfo('client_email.opted_out', {
      action: 'unsubscribeClient',
      preferenceId: preference.id,
    });

    return NextResponse.redirect(
      new URL('/unsubscribe?status=success&type=marketing', request.url)
    );
  } catch (error) {
    logError('Client unsubscribe error', error, {
      action: 'unsubscribeClient',
    });
    return NextResponse.redirect(
      new URL('/unsubscribe?status=error', request.url)
    );
  }
}
