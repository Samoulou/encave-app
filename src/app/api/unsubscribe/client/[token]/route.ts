import { NextRequest, NextResponse } from 'next/server';
import { applyClientUnsubscribe } from '@/server/services/email-preferences.service';
import { logError, logInfo } from '@/lib/logger';
import {
  checkRateLimit,
  getClientIp,
  GEOCODE_RATE_LIMIT,
} from '@/server/services/rate-limit.service';

export const dynamic = 'force-dynamic';

/**
 * Client-scoped email opt-out (P-07 / decision A4, LCD compliance).
 * Linked from the footer of the « coups de cœur » recap and of the
 * post-visit follow-up, and sent as their List-Unsubscribe header.
 *
 *  - GET  = the footer link. GET-safe: the only effect is flipping
 *    marketingOptOut to true — idempotent, and a mail scanner pre-opening
 *    the link simply opts the client out (the safe failure mode for a
 *    commercial email).
 *  - POST = RFC 8058 one-click (List-Unsubscribe-Post): the mailbox provider
 *    calls it without a browser → plain 200, no redirect.
 */
async function isRateLimited(request: NextRequest): Promise<boolean> {
  // Public endpoint rule: rate-limited (token enumeration / DB load).
  // 30/min per IP — same budget as the other public GET (geocode).
  const rate = await checkRateLimit(
    `unsubscribe-client:${getClientIp(request.headers)}`,
    GEOCODE_RATE_LIMIT
  );
  return !rate.success;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (await isRateLimited(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const result = await applyClientUnsubscribe(token);
    if (!result.ok) {
      return NextResponse.redirect(
        new URL('/unsubscribe?status=invalid', request.url)
      );
    }

    logInfo('client_email.opted_out', {
      action: 'unsubscribeClient',
      preferenceId: result.preferenceId,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (await isRateLimited(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { token } = await params;
    const result = await applyClientUnsubscribe(token);
    if (!result.ok) {
      return NextResponse.json({ error: 'Unknown token' }, { status: 404 });
    }

    logInfo('client_email.opted_out', {
      action: 'unsubscribeClient',
      preferenceId: result.preferenceId,
      oneClick: true,
    });
    return NextResponse.json({ unsubscribed: true });
  } catch (error) {
    logError('Client one-click unsubscribe error', error, {
      action: 'unsubscribeClient',
    });
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}
