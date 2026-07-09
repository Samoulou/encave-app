import { cache } from 'react';
import { BookingStatus, OccurrenceStatus, Prisma } from '@prisma/client';
import { db } from '@/server/db';
import {
  activeCapacityBookingWhere,
  resolveOccurrenceCapacity,
} from '@/lib/business-rules/capacity';
import { OCCURRENCE_PREVIEW_COUNT } from '@/lib/constants/occurrences';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
import { HOLD_EMAIL_DOMAIN } from '@/lib/constants/booking-hold';

/**
 * Occurrence reads (P-05 / L-131, L-132).
 * React.cache ONLY — the DTOs carry Date objects, same constraint as
 * event-detail.queries.ts (unstable_cache would serialize them away).
 */

export interface OccurrencePreviewDTO {
  id: string;
  date: Date;
  startTime: string;
  status: OccurrenceStatus;
  capacity: number;
  source: 'RECURRING' | 'PUNCTUAL';
}

/**
 * Next N occurrences of an experience — the availability builder's live
 * preview (L-131). Blackouts are derived at read time (D3): a blocked
 * date shows as not bookable without ever mutating status.
 */
export const getUpcomingOccurrences = cache(
  async function getUpcomingOccurrences(
    experienceId: string,
    limit: number = OCCURRENCE_PREVIEW_COUNT
  ): Promise<(OccurrencePreviewDTO & { isDateBlocked: boolean })[]> {
    const from = zurichTodayAsUTCDate();
    const [occurrences, experience, blocked] = await Promise.all([
      db.experienceOccurrence.findMany({
        where: { experienceId, date: { gte: from } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: limit,
        select: {
          id: true,
          date: true,
          startTime: true,
          status: true,
          capacityOverride: true,
          source: true,
        },
      }),
      db.experience.findUnique({
        where: { id: experienceId },
        select: { maxCapacity: true },
      }),
      db.blockedDate.findMany({
        where: { experienceId, date: { gte: from } },
        select: { date: true },
      }),
    ]);
    if (!experience) return [];
    const blockedKeys = new Set(
      blocked.map((b) => b.date.toISOString().slice(0, 10))
    );
    return occurrences.map((o) => ({
      id: o.id,
      date: o.date,
      startTime: o.startTime,
      status: o.status,
      capacity: resolveOccurrenceCapacity(
        o.capacityOverride,
        experience.maxCapacity
      ),
      source: o.source,
      isDateBlocked: blockedKeys.has(o.date.toISOString().slice(0, 10)),
    }));
  }
);

export interface OccurrenceCalendarEntryDTO {
  /** Occurrence id, or null for a straggler session (no occurrence row). */
  occurrenceId: string | null;
  date: Date;
  startTime: string;
  status: OccurrenceStatus;
  capacity: number;
  capacityOverride: number | null;
  bookedCount: number;
  isDateBlocked: boolean;
  attendees: {
    bookingId: string;
    reference: string;
    visitorName: string;
    guestCount: number;
    status: BookingStatus;
  }[];
}

export interface OccurrenceCalendarDTO {
  experienceId: string;
  title: string;
  maxCapacity: number;
  monthKey: string; // "YYYY-MM"
  entries: OccurrenceCalendarEntryDTO[];
}

const CALENDAR_ATTENDEE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.PENDING_PAYMENT,
];

/**
 * Monthly occurrence calendar for the OWNER (L-132): every occurrence of
 * the month with its live seat count and attendee list, PLUS straggler
 * sessions derived from bookings that predate the occurrence engine
 * (grouped by COALESCE(occurrence, (date, timeSlot)) per decision D-C).
 * Unclaimed hold rows (sentinel visitor email) never appear.
 */
export const getOccurrenceCalendar = cache(async function getOccurrenceCalendar(
  experienceId: string,
  userId: string,
  monthKey: string
): Promise<OccurrenceCalendarDTO | null> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
  const monthStart = new Date(`${monthKey}-01T00:00:00.000Z`);
  const monthEnd = new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      1,
      0,
      0,
      0
    )
  );

  // Tenant gate: the experience must belong to a winery owned by userId.
  const experience = await db.experience.findFirst({
    where: { id: experienceId, winery: { userId } },
    select: { id: true, title: true, maxCapacity: true },
  });
  if (!experience) return null;

  const dateRange: Prisma.DateTimeFilter = {
    gte: monthStart,
    lt: monthEnd,
  };
  const [occurrences, bookings, blocked] = await Promise.all([
    db.experienceOccurrence.findMany({
      where: { experienceId, date: dateRange },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        status: true,
        capacityOverride: true,
      },
    }),
    db.booking.findMany({
      where: {
        experienceId,
        date: dateRange,
        status: { in: CALENDAR_ATTENDEE_STATUSES },
        NOT: { visitorEmail: { endsWith: `@${HOLD_EMAIL_DOMAIN}` } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reference: true,
        visitorName: true,
        guestCount: true,
        status: true,
        date: true,
        timeSlot: true,
        expiresAt: true,
      },
    }),
    db.blockedDate.findMany({
      where: { experienceId, date: dateRange },
      select: { date: true },
    }),
  ]);

  const blockedKeys = new Set(
    blocked.map((b) => b.date.toISOString().slice(0, 10))
  );
  const keyOf = (date: Date, startTime: string) =>
    `${date.toISOString().slice(0, 10)}|${startTime}`;

  const now = new Date();
  const countsTowardSeats = (b: (typeof bookings)[number]) =>
    b.status === BookingStatus.CONFIRMED ||
    b.status === BookingStatus.COMPLETED ||
    b.status === BookingStatus.NO_SHOW ||
    (b.status === BookingStatus.PENDING_PAYMENT &&
      b.expiresAt !== null &&
      b.expiresAt > now);

  const entries = new Map<string, OccurrenceCalendarEntryDTO>();
  for (const o of occurrences) {
    entries.set(keyOf(o.date, o.startTime), {
      occurrenceId: o.id,
      date: o.date,
      startTime: o.startTime,
      status: o.status,
      capacity: resolveOccurrenceCapacity(
        o.capacityOverride,
        experience.maxCapacity
      ),
      capacityOverride: o.capacityOverride,
      bookedCount: 0,
      isDateBlocked: blockedKeys.has(o.date.toISOString().slice(0, 10)),
      attendees: [],
    });
  }
  for (const b of bookings) {
    const key = keyOf(b.date, b.timeSlot);
    let entry = entries.get(key);
    if (!entry) {
      // Straggler session: bookings without an occurrence row (legacy).
      entry = {
        occurrenceId: null,
        date: b.date,
        startTime: b.timeSlot,
        status: OccurrenceStatus.OPEN,
        capacity: experience.maxCapacity,
        capacityOverride: null,
        bookedCount: 0,
        isDateBlocked: blockedKeys.has(b.date.toISOString().slice(0, 10)),
        attendees: [],
      };
      entries.set(key, entry);
    }
    if (b.status !== BookingStatus.PENDING_PAYMENT) {
      entry.attendees.push({
        bookingId: b.id,
        reference: b.reference,
        visitorName: b.visitorName,
        guestCount: b.guestCount,
        status: b.status,
      });
    }
    if (countsTowardSeats(b)) {
      entry.bookedCount += b.guestCount;
    }
  }

  return {
    experienceId: experience.id,
    title: experience.title,
    maxCapacity: experience.maxCapacity,
    monthKey,
    entries: Array.from(entries.values()).sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.startTime.localeCompare(b.startTime)
    ),
  };
});

export interface BookableOccurrenceDTO {
  id: string;
  date: Date;
  startTime: string;
  remainingCapacity: number;
}

/**
 * Public: OPEN, non-blackout occurrences of an experience in a range,
 * with remaining seats (seat counting on (date,timeSlot) — ADR-0002 D1).
 */
export async function getBookableOccurrences(
  experienceId: string,
  range: { from: Date; to: Date }
): Promise<BookableOccurrenceDTO[]> {
  const [occurrences, experience, blocked, booked] = await Promise.all([
    db.experienceOccurrence.findMany({
      where: {
        experienceId,
        status: OccurrenceStatus.OPEN,
        date: { gte: range.from, lt: range.to },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        capacityOverride: true,
      },
    }),
    db.experience.findUnique({
      where: { id: experienceId },
      select: { maxCapacity: true },
    }),
    db.blockedDate.findMany({
      where: { experienceId, date: { gte: range.from, lt: range.to } },
      select: { date: true },
    }),
    db.booking.groupBy({
      by: ['date', 'timeSlot'],
      where: {
        experienceId,
        date: { gte: range.from, lt: range.to },
        ...activeCapacityBookingWhere(),
      },
      _sum: { guestCount: true },
    }),
  ]);
  if (!experience) return [];
  const blockedKeys = new Set(
    blocked.map((b) => b.date.toISOString().slice(0, 10))
  );
  const bookedByKey = new Map(
    booked.map((b) => [
      `${b.date.toISOString().slice(0, 10)}|${b.timeSlot}`,
      b._sum.guestCount ?? 0,
    ])
  );
  return occurrences
    .filter((o) => !blockedKeys.has(o.date.toISOString().slice(0, 10)))
    .map((o) => {
      const key = `${o.date.toISOString().slice(0, 10)}|${o.startTime}`;
      const capacity = resolveOccurrenceCapacity(
        o.capacityOverride,
        experience.maxCapacity
      );
      return {
        id: o.id,
        date: o.date,
        startTime: o.startTime,
        remainingCapacity: Math.max(0, capacity - (bookedByKey.get(key) ?? 0)),
      };
    });
}
