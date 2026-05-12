import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import { BookingStatus, ExperienceStatus } from '@prisma/client';
import { parseTimeSlot, timeSlotSchema } from '@/lib/validators/booking';
import type {
  BookingDTO,
  EventDetailDTO,
  EventSessionDTO,
  SessionGroup,
} from '@/types/event-detail';

const SESSION_TIMEZONE = 'Europe/Zurich';

/**
 * Compute the UTC instant for a given local (Europe/Zurich) wall-clock
 * formed by `date` (date-only, UTC midnight) at `HH:mm`.
 *
 * Implementation: take the wall-clock interpreted as UTC, then ask the runtime
 * what that instant looks like in Europe/Zurich, derive the offset, and shift.
 * Handles CET (+01:00) / CEST (+02:00) without pulling in date-fns-tz.
 */
function zonedWallClockToUTC(date: Date, timeSlot: string): Date {
  const { hours, minutes } = parseTimeSlot(timeSlot);
  const wallUTC = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );

  // Get the Europe/Zurich representation of wallUTC, parse the components.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(wallUTC);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }
  const zoneAsUTC = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour === '24' ? '0' : lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  const offsetMs = zoneAsUTC - wallUTC.getTime();
  return new Date(wallUTC.getTime() - offsetMs);
}

/**
 * Get the local (Europe/Zurich) date "YYYY-MM-DD" for an instant.
 */
function zonedDateKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

interface RawBookingRow {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  guestCount: number;
  status: BookingStatus;
  checkedInAt: Date | null;
  createdAt: Date;
  date: Date;
  timeSlot: string;
}

const SESSION_DISPLAY_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.CANCELLED_BY_CLIENT,
  BookingStatus.CANCELLED_BY_WINERY,
];

/**
 * Capacity rule (per spec): NO_SHOW still occupies a seat that was sold;
 * cancellations free the seat.
 */
function bookingCountsTowardsCapacity(status: BookingStatus): boolean {
  return (
    status === BookingStatus.CONFIRMED ||
    status === BookingStatus.COMPLETED ||
    status === BookingStatus.NO_SHOW
  );
}

interface FetchedExperience {
  id: string;
  title: string;
  slug: string;
  type: import('@prisma/client').ExperienceType;
  status: ExperienceStatus;
  duration: number;
  maxCapacity: number;
  wineryId: string;
  winery: { id: string; slug: string; name: string; userId: string };
  bookings: RawBookingRow[];
}

async function fetchExperienceForOwner(
  experienceSlug: string,
  userId: string
): Promise<FetchedExperience | null> {
  const experience = await db.experience.findFirst({
    where: {
      slug: experienceSlug,
      status: { not: ExperienceStatus.ARCHIVED },
      winery: { userId },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      status: true,
      duration: true,
      maxCapacity: true,
      wineryId: true,
      winery: {
        select: { id: true, slug: true, name: true, userId: true },
      },
      bookings: {
        where: { status: { in: SESSION_DISPLAY_STATUSES } },
        orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          reference: true,
          visitorName: true,
          visitorEmail: true,
          visitorPhone: true,
          guestCount: true,
          status: true,
          checkedInAt: true,
          createdAt: true,
          date: true,
          timeSlot: true,
        },
      },
    },
  });

  if (!experience) return null;

  return experience satisfies FetchedExperience;
}

function buildSessions(experience: FetchedExperience): EventSessionDTO[] {
  type Accum = {
    sessionId: string;
    date: Date;
    timeSlot: string;
    bookings: BookingDTO[];
    confirmedSeats: number;
  };
  const groups = new Map<string, Accum>();

  const todayKey = zonedDateKey(new Date());

  for (const row of experience.bookings) {
    // Skip rows whose timeSlot is malformed (defensive).
    if (!timeSlotSchema.safeParse(row.timeSlot).success) continue;

    const dateIso = row.date.toISOString().slice(0, 10);
    const key = `${dateIso}|${row.timeSlot}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        sessionId: key,
        date: row.date,
        timeSlot: row.timeSlot,
        bookings: [],
        confirmedSeats: 0,
      };
      groups.set(key, group);
    }

    group.bookings.push({
      id: row.id,
      reference: row.reference,
      visitorName: row.visitorName,
      visitorEmail: row.visitorEmail,
      visitorPhone: row.visitorPhone,
      guestCount: row.guestCount,
      status: row.status,
      checkedInAt: row.checkedInAt,
      createdAt: row.createdAt,
    });

    if (bookingCountsTowardsCapacity(row.status)) {
      group.confirmedSeats += row.guestCount;
    }
  }

  const sessions: EventSessionDTO[] = [];

  for (const group of Array.from(groups.values())) {
    const startsAt = zonedWallClockToUTC(group.date, group.timeSlot);
    const endsAt = new Date(startsAt.getTime() + experience.duration * 60_000);

    const sessionDateKey = zonedDateKey(startsAt);
    const isToday = sessionDateKey === todayKey;
    const isPast = endsAt.getTime() < Date.now() && !isToday;

    const allCancelled =
      group.bookings.length > 0 &&
      group.bookings.every(
        (b: BookingDTO) =>
          b.status === BookingStatus.CANCELLED_BY_CLIENT ||
          b.status === BookingStatus.CANCELLED_BY_WINERY
      );

    let bucket: SessionGroup;
    if (allCancelled) {
      bucket = 'cancelled';
    } else if (isToday) {
      bucket = 'today';
    } else if (isPast) {
      bucket = 'past';
    } else {
      bucket = 'upcoming';
    }

    sessions.push({
      sessionId: group.sessionId,
      date: group.date,
      timeSlot: group.timeSlot,
      startsAt,
      endsAt,
      bookings: group.bookings,
      confirmedSeats: group.confirmedSeats,
      totalCapacity: experience.maxCapacity,
      isFull: group.confirmedSeats >= experience.maxCapacity,
      group: bucket,
    });
  }

  // Order: today (asc) → upcoming (asc) → past (desc) → cancelled (asc).
  const bucketRank: Record<SessionGroup, number> = {
    today: 0,
    upcoming: 1,
    past: 2,
    cancelled: 3,
  };

  sessions.sort((a, b) => {
    const rankDelta = bucketRank[a.group] - bucketRank[b.group];
    if (rankDelta !== 0) return rankDelta;
    if (a.group === 'past') {
      return b.startsAt.getTime() - a.startsAt.getTime();
    }
    return a.startsAt.getTime() - b.startsAt.getTime();
  });

  return sessions;
}

function buildEventDetail(experience: FetchedExperience): EventDetailDTO {
  const sessions = buildSessions(experience);

  let totalConfirmedSeats = 0;
  let totalActiveCapacity = 0;
  let activeSessionsCount = 0;

  for (const session of sessions) {
    if (session.group === 'today' || session.group === 'upcoming') {
      totalConfirmedSeats += session.confirmedSeats;
      totalActiveCapacity += session.totalCapacity;
      activeSessionsCount += 1;
    }
  }

  return {
    experience: {
      id: experience.id,
      title: experience.title,
      slug: experience.slug,
      type: experience.type,
      status: experience.status,
      duration: experience.duration,
      maxCapacity: experience.maxCapacity,
      winery: {
        id: experience.winery.id,
        slug: experience.winery.slug,
        name: experience.winery.name,
      },
    },
    sessions,
    totalConfirmedSeats,
    totalActiveCapacity,
    activeSessionsCount,
  };
}

/**
 * Get the winemaker event detail (sessions + bookings grouped) for the given
 * experience slug. Returns null when the experience doesn't exist, is archived,
 * or does not belong to the user's winery.
 *
 * Cached at the request level (React.cache) and persistent (unstable_cache)
 * for 60 seconds. Invalidate via the action layer using tags
 *   - `event-detail:<experienceSlug>`
 *   - `winery-user:<userId>:bookings`
 *
 * Note: `isLive` and the H-2 / H+2 scan window are deliberately NOT cached —
 * they depend on the current instant. Compute them in the page Server
 * Component from `startsAt` / `endsAt`.
 */
export const getEventDetail = cache(
  (experienceSlug: string, userId: string) => {
    return unstable_cache(
      async (): Promise<EventDetailDTO | null> => {
        const experience = await fetchExperienceForOwner(
          experienceSlug,
          userId
        );
        if (!experience) return null;
        return buildEventDetail(experience);
      },
      ['event-detail', experienceSlug, userId],
      {
        revalidate: 60,
        tags: [
          `event-detail:${experienceSlug}`,
          `winery-user:${userId}:bookings`,
        ],
      }
    )();
  }
);
