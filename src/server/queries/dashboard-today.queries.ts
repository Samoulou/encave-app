import { cache } from 'react';
import { BookingStatus, OccurrenceStatus } from '@prisma/client';
import { addDays } from 'date-fns';
import { db } from '@/server/db';
import {
  activeCapacityBookingWhere,
  resolveOccurrenceCapacity,
} from '@/lib/business-rules/capacity';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

/**
 * « Aujourd'hui » landing reads (P-13 / L-130).
 * React.cache only — same doctrine as occurrence.queries.ts. Every query
 * tenant-gates on the owner's winery (userId).
 */

const FILL_RATE_WINDOW_DAYS = 30;

/**
 * Seats that consumed capacity, past or future: terminal attended
 * statuses + the live capacity predicate — the same composition as
 * getOccurrenceCalendar.countsTowardSeats, expressed as a Prisma where.
 */
function seatCountingBookingWhere(now: Date) {
  return {
    OR: [
      { status: { in: [BookingStatus.COMPLETED, BookingStatus.NO_SHOW] } },
      activeCapacityBookingWhere(now),
    ],
  };
}

export interface WineryFillRateDTO {
  soldSeats: number;
  offeredSeats: number;
  /** null when no capacity was offered in the window (KPI shows «—»). */
  ratePct: number | null;
}

/**
 * Real 30-day fill rate (replaces the L-011 placebo): sold seats over
 * offered capacity, on the winery's PERSISTED occurrences of the last
 * 30 Zurich days (CANCELLED excluded — that capacity was never for
 * sale). Straggler bookings without an occurrence row are excluded
 * (no denominator to relate them to).
 */
export const getWineryFillRate30d = cache(
  async (userId: string): Promise<WineryFillRateDTO> => {
    const now = new Date();
    const todayUTC = zurichTodayAsUTCDate(now);
    const windowStart = addDays(todayUTC, -FILL_RATE_WINDOW_DAYS);

    const [occurrences, soldGroups] = await Promise.all([
      db.experienceOccurrence.findMany({
        where: {
          experience: { winery: { userId } },
          date: { gte: windowStart, lt: todayUTC },
          status: { not: OccurrenceStatus.CANCELLED },
        },
        select: {
          experienceId: true,
          date: true,
          startTime: true,
          capacityOverride: true,
          experience: { select: { maxCapacity: true } },
        },
      }),
      db.booking.groupBy({
        by: ['experienceId', 'date', 'timeSlot'],
        where: {
          winery: { userId },
          date: { gte: windowStart, lt: todayUTC },
          ...seatCountingBookingWhere(now),
        },
        _sum: { guestCount: true },
      }),
    ]);

    const soldByKey = new Map(
      soldGroups.map((group) => [
        `${group.experienceId}|${group.date.toISOString().slice(0, 10)}|${group.timeSlot}`,
        group._sum.guestCount ?? 0,
      ])
    );

    let offeredSeats = 0;
    let soldSeats = 0;
    for (const occurrence of occurrences) {
      offeredSeats += resolveOccurrenceCapacity(
        occurrence.capacityOverride,
        occurrence.experience.maxCapacity
      );
      const key = `${occurrence.experienceId}|${occurrence.date.toISOString().slice(0, 10)}|${occurrence.startTime}`;
      soldSeats += soldByKey.get(key) ?? 0;
    }

    return {
      soldSeats,
      offeredSeats,
      ratePct:
        offeredSeats > 0 ? Math.round((soldSeats / offeredSeats) * 100) : null,
    };
  }
);

export interface UpcomingWinerySessionDTO {
  occurrenceId: string;
  experienceId: string;
  experienceTitle: string;
  /** Calendar date (UTC midnight). */
  date: Date;
  startTime: string;
  soldSeats: number;
  capacity: number;
}

/**
 * Next bookable sessions across ALL of the winery's experiences, with
 * seat gauges — the « prochains créneaux » block of the landing.
 * OPEN occurrences only, blackout dates excluded (D3 doctrine: reads
 * derive the gate, occurrence status is never mutated by blackouts).
 */
export const getUpcomingWinerySessions = cache(
  async (
    userId: string,
    options: { days?: number; limit?: number } = {}
  ): Promise<UpcomingWinerySessionDTO[]> => {
    const { days = 7, limit = 6 } = options;
    const now = new Date();
    const todayUTC = zurichTodayAsUTCDate(now);
    const windowEnd = addDays(todayUTC, days);

    const [occurrences, blocked, soldGroups] = await Promise.all([
      db.experienceOccurrence.findMany({
        where: {
          experience: { winery: { userId } },
          date: { gte: todayUTC, lt: windowEnd },
          status: OccurrenceStatus.OPEN,
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        select: {
          id: true,
          experienceId: true,
          date: true,
          startTime: true,
          capacityOverride: true,
          experience: { select: { title: true, maxCapacity: true } },
        },
      }),
      db.blockedDate.findMany({
        where: {
          experience: { winery: { userId } },
          date: { gte: todayUTC, lt: windowEnd },
        },
        select: { experienceId: true, date: true },
      }),
      db.booking.groupBy({
        by: ['experienceId', 'date', 'timeSlot'],
        where: {
          winery: { userId },
          date: { gte: todayUTC, lt: windowEnd },
          ...seatCountingBookingWhere(now),
        },
        _sum: { guestCount: true },
      }),
    ]);

    const blockedKeys = new Set(
      blocked.map(
        (entry) =>
          `${entry.experienceId}|${entry.date.toISOString().slice(0, 10)}`
      )
    );
    const soldByKey = new Map(
      soldGroups.map((group) => [
        `${group.experienceId}|${group.date.toISOString().slice(0, 10)}|${group.timeSlot}`,
        group._sum.guestCount ?? 0,
      ])
    );

    return occurrences
      .filter(
        (occurrence) =>
          !blockedKeys.has(
            `${occurrence.experienceId}|${occurrence.date.toISOString().slice(0, 10)}`
          )
      )
      .slice(0, limit)
      .map((occurrence) => ({
        occurrenceId: occurrence.id,
        experienceId: occurrence.experienceId,
        experienceTitle: occurrence.experience.title,
        date: occurrence.date,
        startTime: occurrence.startTime,
        soldSeats:
          soldByKey.get(
            `${occurrence.experienceId}|${occurrence.date.toISOString().slice(0, 10)}|${occurrence.startTime}`
          ) ?? 0,
        capacity: resolveOccurrenceCapacity(
          occurrence.capacityOverride,
          occurrence.experience.maxCapacity
        ),
      }));
  }
);

/**
 * Gross revenue of the current Zurich month (D3: « CA du mois » is what
 * clients PAID — Σ totalPrice, fee excluded). NO_SHOW kept its money
 * (no refund path), so it stays counted, like getWineryGmv.
 */
export const getMonthGrossRevenue = cache(
  async (userId: string): Promise<number> => {
    const todayUTC = zurichTodayAsUTCDate(new Date());
    const monthStart = new Date(
      Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)
    );
    const monthEnd = new Date(
      Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 1)
    );

    const result = await db.booking.aggregate({
      where: {
        winery: { userId },
        date: { gte: monthStart, lt: monthEnd },
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.COMPLETED,
            BookingStatus.NO_SHOW,
          ],
        },
      },
      _sum: { totalPrice: true },
    });
    return result._sum.totalPrice ?? 0;
  }
);
