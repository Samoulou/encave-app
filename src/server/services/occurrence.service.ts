/**
 * Occurrence engine (P-05 / L-024, ADR-0002).
 *
 * Internal service — no 'use server', no auth(): called by server
 * actions, the publish/edit flows and the cron. All writes are ADDITIVE
 * (`createMany skipDuplicates` = INSERT ... ON CONFLICT DO NOTHING) and
 * run in plain Read Committed — NEVER inside a Serializable transaction
 * (a racing upsert there would raise unretried P2002s and fabricate
 * hold-vs-hold write conflicts; see ADR-0002 Alt B).
 */

import { OccurrenceSource, OccurrenceStatus } from '@prisma/client';
import { db } from '@/server/db';
import {
  expandRecurringDates,
  normalizePunctualDates,
  zurichTodayAsUTCDate,
  dateKeyOf,
} from '@/lib/business-rules/occurrence-expansion';
import { OCCURRENCE_HORIZON_DAYS } from '@/lib/constants/occurrences';
import { logInfo } from '@/lib/logger';

/**
 * Typed refusal of the defensive resolution path. Callers (server
 * actions) map `code` onto ActionResult error codes.
 */
export class OccurrenceResolutionError extends Error {
  constructor(
    // TS parameter property — used by callers; base no-unused-vars
    // false-positives on it (same idiom as Pagination.tsx).
    /* eslint-disable-next-line no-unused-vars */
    public readonly code: 'DATE_BLOCKED' | 'INVALID_SLOT',
    message: string
  ) {
    super(message);
    this.name = 'OccurrenceResolutionError';
  }
}

export interface ResolvedOccurrence {
  id: string;
  status: OccurrenceStatus;
  capacityOverride: number | null;
}

/**
 * Materialize OPEN occurrences from the experience's active weekly
 * slots over the rolling horizon, skipping blacked-out dates.
 * Idempotent and additive — safe to call from publish, availability
 * edits, unblock and the daily cron concurrently.
 */
export async function generateOccurrences(
  experienceId: string,
  opts?: { horizonDays?: number; now?: Date }
): Promise<{ created: number }> {
  const horizonDays = opts?.horizonDays ?? OCCURRENCE_HORIZON_DAYS;
  const from = zurichTodayAsUTCDate(opts?.now ?? new Date());
  const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const experience = await db.experience.findUnique({
    where: { id: experienceId },
    select: {
      id: true,
      availabilitySlots: {
        where: { isActive: true },
        select: { dayOfWeek: true, startTime: true, isActive: true },
      },
      blockedDates: {
        where: { date: { gte: from, lt: to } },
        select: { date: true },
      },
    },
  });
  if (!experience) return { created: 0 };

  const seeds = expandRecurringDates({
    slots: experience.availabilitySlots,
    blackoutDates: experience.blockedDates.map((b) => b.date),
    from,
    horizonDays,
  });
  if (seeds.length === 0) return { created: 0 };

  const { count } = await db.experienceOccurrence.createMany({
    data: seeds.map((seed) => ({
      experienceId,
      date: seed.date,
      startTime: seed.startTime,
      status: OccurrenceStatus.OPEN,
      source: OccurrenceSource.RECURRING,
    })),
    skipDuplicates: true,
  });

  if (count > 0) {
    logInfo('occurrences.generated', {
      action: 'generateOccurrences',
      experienceId,
      created: count,
      horizonDays,
    });
  }
  return { created: count };
}

/**
 * Materialize punctual occurrences from explicit (date, startTime)
 * picks (L-131 chips UI). Same additive/idempotent write path; picks
 * before today (Zurich) are dropped by normalization.
 */
export async function createPunctualOccurrences(
  experienceId: string,
  picks: readonly { date: Date; startTime: string }[],
  opts?: { now?: Date }
): Promise<{ created: number }> {
  const from = zurichTodayAsUTCDate(opts?.now ?? new Date());
  const seeds = normalizePunctualDates({ picks, from });
  if (seeds.length === 0) return { created: 0 };

  const { count } = await db.experienceOccurrence.createMany({
    data: seeds.map((seed) => ({
      experienceId,
      date: seed.date,
      startTime: seed.startTime,
      status: OccurrenceStatus.OPEN,
      source: OccurrenceSource.PUNCTUAL,
    })),
    skipDuplicates: true,
  });
  return { created: count };
}

/**
 * Close future RECURRING occurrences that no longer match an active
 * weekly slot — a removed slot must stop selling immediately, not after
 * 6 weeks of orphaned OPEN rows. PUNCTUAL rows are never touched;
 * CANCELLED stays CANCELLED; a manually reopened orphan is re-closed on
 * the next edit (an owner insisting on a one-off date should add it as
 * punctual). Existing bookings keep their seats — seat counting is on
 * (date, timeSlot), not status (ADR-0002 D1) — closing only stops NEW
 * bookings.
 */
export async function closeOrphanedRecurringOccurrences(
  experienceId: string,
  opts?: { now?: Date }
): Promise<{ closed: number }> {
  const from = zurichTodayAsUTCDate(opts?.now ?? new Date());
  const [slots, occurrences] = await Promise.all([
    db.availabilitySlot.findMany({
      where: { experienceId, isActive: true },
      select: { dayOfWeek: true, startTime: true },
    }),
    db.experienceOccurrence.findMany({
      where: {
        experienceId,
        source: OccurrenceSource.RECURRING,
        status: OccurrenceStatus.OPEN,
        date: { gte: from },
      },
      select: { id: true, date: true, startTime: true },
    }),
  ]);
  const activeKeys = new Set(
    slots.map((slot) => `${slot.dayOfWeek}|${slot.startTime}`)
  );
  const orphanIds = occurrences
    .filter((o) => !activeKeys.has(`${o.date.getUTCDay()}|${o.startTime}`))
    .map((o) => o.id);
  if (orphanIds.length === 0) return { closed: 0 };

  const { count } = await db.experienceOccurrence.updateMany({
    where: { id: { in: orphanIds }, status: OccurrenceStatus.OPEN },
    data: { status: OccurrenceStatus.CLOSED },
  });
  logInfo('occurrences.orphans_closed', {
    action: 'closeOrphanedRecurringOccurrences',
    experienceId,
    closed: count,
  });
  return { closed: count };
}

/**
 * Resolve-or-create the occurrence backing a slot — the booking path's
 * defensive backstop (hold + fallback create), run BEFORE the
 * Serializable transaction (ADR-0002 §3).
 *
 * Refuses `INVALID_SLOT` for any past date (a stale OPEN row for
 * yesterday must not stay holdable), `DATE_BLOCKED` when the date is
 * blacked out (even for an existing occurrence — BlockedDate is
 * authoritative, decision D3) and `INVALID_SLOT` when the slot matches
 * no active weekly slot and no punctual occurrence exists (closes the
 * pre-existing hole where arbitrary slots were holdable). The horizon
 * bounds EAGER generation only, never the booking window: the public
 * picker offers 3 months, so any future date backed by an active weekly
 * slot materializes on demand. Never raises P2002: the create path is
 * `createMany skipDuplicates` — a racing loser silently falls through
 * to the read.
 */
export async function resolveOccurrence(
  experienceId: string,
  date: Date,
  startTime: string,
  opts?: { now?: Date }
): Promise<ResolvedOccurrence> {
  const from = zurichTodayAsUTCDate(opts?.now ?? new Date());
  if (date.getTime() < from.getTime()) {
    throw new OccurrenceResolutionError(
      'INVALID_SLOT',
      `Date ${dateKeyOf(date)} is in the past for experience ${experienceId}`
    );
  }

  const [blocked, existing] = await Promise.all([
    db.blockedDate.findUnique({
      where: { experienceId_date: { experienceId, date } },
      select: { id: true },
    }),
    db.experienceOccurrence.findUnique({
      where: {
        experienceId_date_startTime: { experienceId, date, startTime },
      },
      select: { id: true, status: true, capacityOverride: true },
    }),
  ]);
  if (blocked) {
    throw new OccurrenceResolutionError(
      'DATE_BLOCKED',
      `Date ${dateKeyOf(date)} is blocked for experience ${experienceId}`
    );
  }
  if (existing) return existing;

  // No occurrence yet — any FUTURE date backed by an active weekly slot
  // is legitimate (punctual slots always exist already, they are created
  // explicitly by the owner).
  const matchingSlot = await db.availabilitySlot.findFirst({
    where: {
      experienceId,
      dayOfWeek: date.getUTCDay(),
      startTime,
      isActive: true,
    },
    select: { id: true },
  });
  if (!matchingSlot) {
    throw new OccurrenceResolutionError(
      'INVALID_SLOT',
      `No bookable slot at ${dateKeyOf(date)} ${startTime} for experience ${experienceId}`
    );
  }

  await db.experienceOccurrence.createMany({
    data: [
      {
        experienceId,
        date,
        startTime,
        status: OccurrenceStatus.OPEN,
        source: OccurrenceSource.RECURRING,
      },
    ],
    skipDuplicates: true,
  });
  return db.experienceOccurrence.findUniqueOrThrow({
    where: {
      experienceId_date_startTime: { experienceId, date, startTime },
    },
    select: { id: true, status: true, capacityOverride: true },
  });
}
