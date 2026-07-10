import { cache } from 'react';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { sessionEndUTC } from '@/lib/datetime/zurich';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
import { hashToken } from '@/lib/utils/token';

/**
 * Wine catalogue + tasting loop reads (P-07).
 *
 * React.cache only (request-level): the DTOs are small and owner-scoped,
 * and freshness after a mutation comes from the action's router.refresh —
 * same doctrine as occurrence.queries.ts (P-05).
 */

export interface WineDTO {
  id: string;
  name: string;
  grapeVariety: string;
  vintage: number | null;
  price: number; // cents
  available: boolean;
  /** > 0 = the wine was served at least once — delete is refused (CONFLICT). */
  servedCount: number;
}

export const getOwnerWines = cache(
  async (userId: string): Promise<WineDTO[]> => {
    const wines = await db.wine.findMany({
      where: { winery: { userId } },
      orderBy: [{ available: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        grapeVariety: true,
        vintage: true,
        price: true,
        available: true,
        _count: { select: { bookingWines: true } },
      },
    });
    return wines.map((wine) => ({
      id: wine.id,
      name: wine.name,
      grapeVariety: wine.grapeVariety,
      vintage: wine.vintage,
      price: wine.price,
      available: wine.available,
      servedCount: wine._count.bookingWines,
    }));
  }
);

export interface TastingEmailStatsDTO {
  sent: number;
  opened: number;
  clicked: number;
}

/**
 * Per-winery J+2 recap engagement (DoD: "open/click tracés par cave").
 * Opens/clicks land via the Resend webhook — zeros until it is configured.
 */
export const getTastingEmailStats = cache(
  async (userId: string): Promise<TastingEmailStatsDTO> => {
    const winery = await db.winery.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!winery) return { sent: 0, opened: 0, clicked: 0 };

    const [sent, opened, clicked] = await Promise.all([
      db.emailLog.count({
        where: { wineryId: winery.id, type: 'tasting_recap', status: 'sent' },
      }),
      db.emailLog.count({
        where: {
          wineryId: winery.id,
          type: 'tasting_recap',
          openedAt: { not: null },
        },
      }),
      db.emailLog.count({
        where: {
          wineryId: winery.id,
          type: 'tasting_recap',
          clickedAt: { not: null },
        },
      }),
    ]);
    return { sent, opened, clicked };
  }
);

export interface EmptySheetSessionDTO {
  experienceId: string;
  experienceTitle: string;
  /** Calendar date (UTC midnight) of the session. */
  date: Date;
  timeSlot: string;
  attendeeCount: number;
}

/**
 * Sessions of the given Zurich calendar day that already ENDED with at
 * least one active booking and an empty tasting sheet. Feeds both the
 * dashboard alert banner and the 21h reminder email (L-063).
 *
 * Not React.cached: also called from the cron route (no request scope).
 */
export async function findEmptySheetSessions(options: {
  wineryId: string;
  now: Date;
}): Promise<EmptySheetSessionDTO[]> {
  const { wineryId, now } = options;
  const todayUTC = zurichTodayAsUTCDate(now);

  const bookings = await db.booking.findMany({
    where: {
      wineryId,
      date: todayUTC,
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    },
    select: {
      guestCount: true,
      timeSlot: true,
      experienceId: true,
      experience: { select: { title: true, duration: true } },
      wines: { select: { id: true }, take: 1 },
    },
  });

  // Group per session (experienceId, timeSlot) — date is fixed to today.
  const sessions = new Map<
    string,
    EmptySheetSessionDTO & { duration: number; hasWines: boolean }
  >();
  for (const booking of bookings) {
    const key = `${booking.experienceId}|${booking.timeSlot}`;
    const existing = sessions.get(key);
    if (existing) {
      existing.attendeeCount += booking.guestCount;
      existing.hasWines = existing.hasWines || booking.wines.length > 0;
    } else {
      sessions.set(key, {
        experienceId: booking.experienceId,
        experienceTitle: booking.experience.title,
        date: todayUTC,
        timeSlot: booking.timeSlot,
        attendeeCount: booking.guestCount,
        duration: booking.experience.duration,
        hasWines: booking.wines.length > 0,
      });
    }
  }

  return Array.from(sessions.values())
    .filter((session) => {
      if (session.hasWines) return false;
      return (
        sessionEndUTC(session.date, session.timeSlot, session.duration) <= now
      );
    })
    .map((session) => ({
      experienceId: session.experienceId,
      experienceTitle: session.experienceTitle,
      date: session.date,
      timeSlot: session.timeSlot,
      attendeeCount: session.attendeeCount,
    }))
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
}

/** Owner-scoped variant for the dashboard banner. */
export const getOwnerEmptySheetSessionsToday = cache(
  async (userId: string): Promise<EmptySheetSessionDTO[]> => {
    const winery = await db.winery.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!winery) return [];
    return findEmptySheetSessions({ wineryId: winery.id, now: new Date() });
  }
);

export interface WineOrderPageDTO {
  bookingId: string;
  guestName: string;
  /** Server-side only (PostHog identity) — never passed to the client. */
  guestEmail: string;
  wineryName: string;
  alreadyRequested: boolean;
  /** Wines served at the tasting (BookingWine), prices as of now. */
  wines: {
    id: string;
    name: string;
    grapeVariety: string;
    vintage: number | null;
    price: number;
  }[];
}

/**
 * Read-only data of the tokenized wine-order page (P-07 / D3). Token =
 * recap token (from the J+2 email) OR the booking access token (ticket
 * link). Returns null on any mismatch — the page 404s without leaking
 * whether the booking exists. NEVER mutates (mail scanners GET this).
 */
export async function getWineOrderPageData(
  bookingId: string,
  token: string
): Promise<WineOrderPageDTO | null> {
  if (token.length < 32 || token.length > 128) return null;
  const tokenHash = hashToken(token);
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      OR: [{ recapTokenHash: tokenHash }, { accessTokenHash: tokenHash }],
    },
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      winery: { select: { name: true } },
      wineOrderRequest: { select: { id: true } },
      wines: {
        select: {
          wine: {
            select: {
              id: true,
              name: true,
              grapeVariety: true,
              vintage: true,
              price: true,
            },
          },
        },
      },
    },
  });
  if (!booking || booking.wines.length === 0) return null;
  return {
    bookingId: booking.id,
    guestName: booking.visitorName,
    guestEmail: booking.visitorEmail,
    wineryName: booking.winery.name,
    alreadyRequested: booking.wineOrderRequest !== null,
    wines: booking.wines.map(({ wine }) => wine),
  };
}
