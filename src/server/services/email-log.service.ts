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
  | 'wine_order_request';

type EmailLogStatus = 'sent' | 'failed' | 'skipped';

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

export async function getRecentEmailLogs(
  type?: EmailLogType,
  status?: EmailLogStatus,
  limit = 100
) {
  return db.emailLog.findMany({
    where: {
      ...(type && { type }),
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
