import { NextRequest, NextResponse } from 'next/server';
import {
  applyWineryUnsubscribe,
  parseWineryUnsubscribeType,
} from '@/server/services/email-preferences.service';
import {
  checkRateLimit,
  getClientIp,
  GEOCODE_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Winery opt-out link of the aggregate emails (daily digest, weekly
 * summary). Produced by getWineryUnsubscribeUrl; `?type=` scopes what is
 * switched off (unknown/absent = all).
 *
 *  - GET  = the footer link → flips the preference, redirects to the
 *    localized confirmation page.
 *  - POST = RFC 8058 one-click (List-Unsubscribe-Post header): the mailbox
 *    provider calls it without a browser → plain 200, no redirect.
 *
 * Public endpoint → rate limited per IP (token enumeration / DB load).
 */
async function isRateLimited(request: NextRequest): Promise<boolean> {
  const rate = await checkRateLimit(
    `unsubscribe:${getClientIp(request.headers)}`,
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
    const type = parseWineryUnsubscribeType(
      request.nextUrl.searchParams.get('type')
    );
    const outcome = await applyWineryUnsubscribe(token, type);

    if (outcome !== 'success') {
      return NextResponse.redirect(
        new URL(`/unsubscribe?status=${outcome}`, request.url)
      );
    }

    logInfo('winery_email.unsubscribed', {
      action: 'unsubscribeWinery',
      type,
    });
    return NextResponse.redirect(
      new URL(`/unsubscribe?status=success&type=${type}`, request.url)
    );
  } catch (error) {
    logError('Unsubscribe error', error, { action: 'unsubscribe' });
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
    const type = parseWineryUnsubscribeType(
      request.nextUrl.searchParams.get('type')
    );
    const outcome = await applyWineryUnsubscribe(token, type);

    if (outcome === 'invalid') {
      return NextResponse.json({ error: 'Unknown token' }, { status: 404 });
    }
    if (outcome === 'expired') {
      return NextResponse.json({ error: 'Expired token' }, { status: 410 });
    }

    logInfo('winery_email.unsubscribed', {
      action: 'unsubscribeWinery',
      type,
      oneClick: true,
    });
    return NextResponse.json({ unsubscribed: true, type });
  } catch (error) {
    logError('One-click unsubscribe error', error, { action: 'unsubscribe' });
    return NextResponse.json({ error: 'Unsubscribe failed' }, { status: 500 });
  }
}
