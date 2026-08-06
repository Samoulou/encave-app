import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { logError, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ResendWebhookEvent {
  type?: string;
  created_at?: string;
  data?: { email_id?: string };
}

/**
 * Resend engagement webhook (P-07 / decision A3): email.opened and
 * email.clicked land on the EmailLog row matched by resendMessageId
 * (captured at send time), first-wins — that powers the per-winery
 * open/click stats on /dashboard/wines.
 *
 * Ops prerequisites (documented in the PR): open/click tracking enabled
 * on the sending domain + a webhook pointing here, its svix signing
 * secret in RESEND_WEBHOOK_SECRET. Unset secret = 503 (misconfiguration
 * is visible, nothing is trusted unsigned).
 */
export async function POST(request: NextRequest) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const payload = await request.text();
  let event: ResendWebhookEvent;
  try {
    const webhook = new Webhook(secret);
    event = webhook.verify(payload, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    }) as ResendWebhookEvent;
  } catch (error) {
    logWarn('Resend webhook signature verification failed', {
      action: 'resendWebhook',
      error: String(error),
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const messageId = event.data?.email_id;
    if (!messageId) {
      return NextResponse.json({ received: true });
    }

    const occurredAt = event.created_at
      ? new Date(event.created_at)
      : new Date();
    const timestamp = Number.isNaN(occurredAt.getTime())
      ? new Date()
      : occurredAt;

    // First-wins: only fill the column when still null. Unknown message
    // ids (emails without tracking metadata) are acknowledged silently.
    if (event.type === 'email.opened') {
      await db.emailLog.updateMany({
        where: { resendMessageId: messageId, openedAt: null },
        data: { openedAt: timestamp },
      });
    } else if (event.type === 'email.clicked') {
      await db.emailLog.updateMany({
        where: { resendMessageId: messageId, clickedAt: null },
        data: { clickedAt: timestamp },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logError('Resend webhook processing error', error, {
      action: 'resendWebhook',
    });
    // Resend retries on non-2xx — a transient DB error deserves a retry.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
