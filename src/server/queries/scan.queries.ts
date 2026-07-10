import { cache } from 'react';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

/**
 * Offline-tolerant scan (P-13 / L-140, D2): the scan page preloads the
 * day's guest list once while online, then matches scanned tokens
 * LOCALLY against accessTokenHash. Only sha256 hashes ever reach the
 * client — and only for the authenticated owner's own winery. The
 * plaintext token lives in the guest's QR code alone.
 */

export interface ScanDayEntryDTO {
  bookingId: string;
  /** sha256 of the booking access token (never the token itself). */
  accessTokenHash: string;
  visitorName: string;
  guestCount: number;
  status: BookingStatus;
  /** Epoch ms — serializable across the RSC boundary. */
  checkedInAtMs: number | null;
  timeSlot: string;
  experienceTitle: string;
}

/**
 * Today's (Zurich) scannable bookings of the caller's winery. CONFIRMED
 * = to scan; COMPLETED = already scanned (shown as "already"). Cancelled
 * and no-show bookings are excluded — the server action refuses them
 * anyway, and an offline ✓ for a cancelled ticket would be a lie.
 */
export const getScanDayList = cache(async function getScanDayList(
  userId: string
): Promise<ScanDayEntryDTO[] | null> {
  const winery = await db.winery.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!winery) return null;

  const today = zurichTodayAsUTCDate();

  const bookings = await db.booking.findMany({
    where: {
      wineryId: winery.id,
      date: today,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
      accessTokenHash: { not: null },
    },
    orderBy: [{ timeSlot: 'asc' }, { visitorName: 'asc' }],
    select: {
      id: true,
      accessTokenHash: true,
      visitorName: true,
      guestCount: true,
      status: true,
      checkedInAt: true,
      timeSlot: true,
      experience: { select: { title: true } },
    },
  });

  const entries: ScanDayEntryDTO[] = [];
  for (const booking of bookings) {
    if (booking.accessTokenHash === null) continue; // narrowed by the where
    entries.push({
      bookingId: booking.id,
      accessTokenHash: booking.accessTokenHash,
      visitorName: booking.visitorName,
      guestCount: booking.guestCount,
      status: booking.status,
      checkedInAtMs: booking.checkedInAt?.getTime() ?? null,
      timeSlot: booking.timeSlot,
      experienceTitle: booking.experience.title,
    });
  }
  return entries;
});
