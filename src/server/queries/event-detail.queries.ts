import { cache } from 'react';
import { db } from '@/server/db';
import { BookingStatus, ExperienceStatus } from '@prisma/client';
import { timeSlotSchema } from '@/lib/validators/booking';
import { zonedWallClockToUTC, zonedDateKey } from '@/lib/datetime/zurich';
import type {
  BookingDTO,
  EventDetailDTO,
  EventSessionDTO,
  SessionGroup,
} from '@/types/event-detail';

interface RawBookingRow {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
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
  experienceId: string,
  userId: string
): Promise<FetchedExperience | null> {
  const experience = await db.experience.findFirst({
    where: {
      id: experienceId,
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
 * experience id. Returns null when the experience doesn't exist, is archived,
 * or does not belong to the user's winery.
 *
 * Request-level deduplication via React.cache only. We intentionally do NOT
 * use unstable_cache here because the DTO embeds Date instances (startsAt,
 * endsAt, createdAt, checkedInAt) and unstable_cache serializes its return
 * value, which would turn these into ISO strings on subsequent calls and
 * crash the Server Component on `.getTime()`. Operational dashboards must
 * also stay fresh on every request anyway.
 */
export const getEventDetail = cache(
  async (
    experienceId: string,
    userId: string
  ): Promise<EventDetailDTO | null> => {
    const experience = await fetchExperienceForOwner(experienceId, userId);
    if (!experience) return null;
    return buildEventDetail(experience);
  }
);
