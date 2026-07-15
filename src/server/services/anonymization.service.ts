import { createId } from '@paralleldrive/cuid2';
import { BookingStatus, Prisma, WineryStatus } from '@prisma/client';
import { db } from '@/server/db';
import { logInfo } from '@/lib/logger';
import { sendAccountDeletedEmail } from '@/server/services/email.service';

interface AnonymizeUserOptions {
  actorId?: string;
  reason?: string;
  /**
   * Send the "account deleted" email to the user. Defaults to true so the
   * self-service path is unchanged; admin-initiated anonymization decides per
   * case (P-15 / L-162).
   */
  notifyUser?: boolean;
}

// Booking.date is @db.Date (stored at midnight): comparing to `new Date()`
// after 00:00 would silently exclude TODAY's sessions.
function localDateToUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

export async function anonymizeUser(
  userId: string,
  options: AnonymizeUserOptions = {}
): Promise<{ alreadyAnonymized: boolean }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      winery: {
        include: {
          bookings: {
            where: {
              status: BookingStatus.CONFIRMED,
              date: { gte: localDateToUTC(new Date()) },
            },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.anonymizedAt) return { alreadyAnonymized: true };
  if (user.winery && user.winery.bookings.length > 0) {
    throw new Error(`FUTURE_WINERY_BOOKINGS:${user.winery.bookings.length}`);
  }

  const now = new Date();
  const suffix = createId().slice(0, 8);
  const deletedEmail = `deleted-${suffix}@encave.ch`;
  const deletedName = 'Utilisateur supprime';

  if (options.notifyUser ?? true) {
    await sendAccountDeletedEmail(user.email, user.preferredLocale);
  }

  await db.$transaction(async (tx) => {
    // Case-insensitive: checkout stores the visitor email as typed, and
    // the privacy export already matches insensitively — deletion must
    // cover the same rows.
    await tx.booking.updateMany({
      where: { visitorEmail: { equals: user.email, mode: 'insensitive' } },
      data: {
        visitorEmail: deletedEmail,
        visitorName: deletedName,
        visitorPhone: '',
      },
    });

    if (user.winery) {
      await tx.experience.updateMany({
        where: { wineryId: user.winery.id, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });
      await tx.winery.update({
        where: { id: user.winery.id },
        data: { status: WineryStatus.SUSPENDED },
      });
    }

    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: deletedEmail,
        name: deletedName,
        image: null,
        emailVerified: false,
        cookieConsent: Prisma.JsonNull,
        anonymizedAt: now,
      },
    });

    if (options.actorId) {
      await tx.adminAction.create({
        data: {
          adminId: options.actorId,
          action: 'USER_ANONYMIZED',
          targetType: 'User',
          targetId: userId,
          reason: options.reason,
        },
      });
    }
  });

  logInfo('user.anonymized', { userId, actorId: options.actorId });
  return { alreadyAnonymized: false };
}
