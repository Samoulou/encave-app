import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { sendWelcomeEmail } from '@/server/services/email.service';

export async function sendWelcomeEmailToWinemaker(
  userId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      preferredLocale: true,
    },
  });

  if (!user || user.role !== 'WINEMAKER') return;

  const existing = await db.emailLog.findFirst({
    where: {
      recipientId: user.id,
      type: 'welcome_winemaker',
      status: 'sent',
    },
    select: { id: true },
  });
  if (existing) return;

  const sent = await sendWelcomeEmail(
    user.email,
    user.name ?? 'Bonjour',
    user.preferredLocale
  );

  await db.emailLog.create({
    data: {
      type: 'welcome_winemaker',
      recipientId: user.id,
      status: sent ? 'sent' : 'failed',
      errorMessage: sent ? null : 'Resend returned failure',
    },
  });

  if (sent) {
    logInfo('welcome_winemaker.sent', { userId: user.id });
  } else {
    logError('welcome winemaker email failed', undefined, {
      action: 'sendWelcomeEmailToWinemaker',
      userId: user.id,
    });
  }
}
