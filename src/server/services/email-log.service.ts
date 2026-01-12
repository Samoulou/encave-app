import { db } from '@/server/db';

type EmailLogType =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'daily_digest'
  | 'follow_up'
  | 'weekly_summary';

type EmailLogStatus = 'sent' | 'failed' | 'skipped';

export async function logEmailSent(
  type: EmailLogType,
  recipientId: string,
  bookingId?: string
): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'sent',
      },
    });
  } catch (error) {
    console.error('[EmailLog] Failed to log sent email:', error);
  }
}

export async function logEmailFailed(
  type: EmailLogType,
  recipientId: string,
  errorMessage: string,
  bookingId?: string
): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'failed',
        errorMessage,
      },
    });
  } catch (error) {
    console.error('[EmailLog] Failed to log failed email:', error);
  }
}

export async function logEmailSkipped(
  type: EmailLogType,
  recipientId: string,
  reason: string,
  bookingId?: string
): Promise<void> {
  try {
    await db.emailLog.create({
      data: {
        type,
        recipientId,
        bookingId,
        status: 'skipped',
        errorMessage: reason,
      },
    });
  } catch (error) {
    console.error('[EmailLog] Failed to log skipped email:', error);
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
