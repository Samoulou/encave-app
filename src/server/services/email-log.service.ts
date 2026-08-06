import * as Sentry from '@sentry/nextjs';
import { db } from '@/server/db';
import { logError } from '@/lib/logger';

type EmailLogType =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'daily_digest'
  | 'follow_up'
  | 'weekly_summary'
  | 'tasting_recap'
  | 'tasting_sheet_reminder'
  | 'wine_order_request'
  | 'stripe_action_required'
  | 'admin_new_winery';

// P-07: optional tracking metadata. resendMessageId links the row to
// Resend open/click webhook events; wineryId powers per-winery stats.
interface EmailLogMeta {
  resendMessageId?: string;
  wineryId?: string;
}

export async function logEmailSent(
  type: EmailLogType,
  recipientId: string,
  bookingId?: string,
  meta?: EmailLogMeta
): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'sent',
        resendMessageId: meta?.resendMessageId,
        wineryId: meta?.wineryId,
      },
    });
  } catch (error) {
    logError('Failed to log sent email', error, { action: 'logEmailSent' });
  }
}

export async function logEmailFailed(
  type: EmailLogType,
  recipientId: string,
  errorMessage: string,
  bookingId?: string,
  meta?: EmailLogMeta
): Promise<void> {
  // P-16 (WS-E): failed sends surface in Sentry (area:email), not only in
  // the email_logs table nobody polls.
  Sentry.captureMessage(`email send failed: ${type}`, {
    level: 'error',
    tags: { area: 'email', emailType: type },
    extra: { errorMessage, bookingId },
  });
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'failed',
        errorMessage,
        wineryId: meta?.wineryId,
      },
    });
  } catch (error) {
    logError('Failed to log failed email', error, { action: 'logEmailFailed' });
  }
}

export async function logEmailSkipped(
  type: EmailLogType,
  recipientId: string,
  reason: string,
  bookingId?: string,
  meta?: EmailLogMeta
): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'skipped',
        errorMessage: reason,
        wineryId: meta?.wineryId,
      },
    });
  } catch (error) {
    logError('Failed to log skipped email', error, {
      action: 'logEmailSkipped',
    });
  }
}
