/**
 * P-05 occurrence engine — against a REAL migrated database.
 * Covers the US-101 generation count, idempotence, the L-132 authority
 * (close/override DO affect booking), the D3 blackout gate and the
 * kill-switch parity (flag OFF = P-04 behavior).
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, OccurrenceStatus } from '@prisma/client';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': `198.51.100.${(process.pid + 1) % 250}` }),
}));

type OccurrenceService = typeof import('@/server/services/occurrence.service');
type CheckoutActions = typeof import('@/server/actions/checkout');
type BookingActions = typeof import('@/server/actions/booking');

/** Next Saturday at least `minDays` out, as a YYYY-MM-DD key (UTC). */
function saturdayKeyAfter(minDays: number): string {
  const d = new Date(Date.now() + minDays * 24 * 60 * 60 * 1000);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!url)('occurrence engine (P-05 / L-024, ADR-0002)', () => {
  let db: PrismaClient;
  let generateOccurrences: OccurrenceService['generateOccurrences'];
  let resolveOccurrence: OccurrenceService['resolveOccurrence'];
  let createPunctualOccurrences: OccurrenceService['createPunctualOccurrences'];
  let closeOrphanedRecurringOccurrences: OccurrenceService['closeOrphanedRecurringOccurrences'];
  let cancelOccurrenceForSlot: OccurrenceService['cancelOccurrenceForSlot'];
  let createBookingHold: CheckoutActions['createBookingHold'];
  let getTimeSlotsForDate: BookingActions['getTimeSlotsForDate'];
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};

  function expId(): string {
    if (!ids.experienceId) throw new Error('experienceId fixture missing');
    return ids.experienceId;
  }

  function inHorizonDateKey(daysFromNow: number): string {
    const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  beforeAll(async () => {
    ({
      generateOccurrences,
      resolveOccurrence,
      createPunctualOccurrences,
      closeOrphanedRecurringOccurrences,
      cancelOccurrenceForSlot,
    } = await import('@/server/services/occurrence.service'));
    ({ createBookingHold } = await import('@/server/actions/checkout'));
    ({ getTimeSlotsForDate } = await import('@/server/actions/booking'));
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `occurrence-engine-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Occurrence Engine Winery ${Date.now()}`,
        slug: `occurrence-engine-${Date.now()}`,
        description: 'Occurrence engine test fixture',
        address: 'Route du Test 3',
        commune: 'Sion',
        phone: '+41270000002',
        email: 'occurrence-engine@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: 'acct_test_occurrence_engine',
        stripeOnboardingComplete: true,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Occurrence Engine Tasting',
        slug: `occurrence-engine-${Date.now()}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;
    // US-101 pattern: Saturday 10:00 and 16:00.
    await db.availabilitySlot.createMany({
      data: [
        {
          experienceId: experience.id,
          dayOfWeek: 6,
          startTime: '10:00',
          endTime: '11:00',
          isActive: true,
        },
        {
          experienceId: experience.id,
          dayOfWeek: 6,
          startTime: '16:00',
          endTime: '17:00',
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    if (ids.wineryId) {
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it('US-101: sat 10h/16h generates exactly 12 OPEN occurrences over the horizon', async () => {
    const { created } = await generateOccurrences(expId());
    expect(created).toBe(12);

    const rows = await db.experienceOccurrence.findMany({
      where: { experienceId: expId() },
    });
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.status === OccurrenceStatus.OPEN)).toBe(true);
    expect(rows.every((r) => r.capacityOverride === null)).toBe(true);
    expect(rows.every((r) => r.source === 'RECURRING')).toBe(true);
  });

  it('generation is idempotent — a second run creates nothing', async () => {
    const { created } = await generateOccurrences(expId());
    expect(created).toBe(0);
    const count = await db.experienceOccurrence.count({
      where: { experienceId: expId() },
    });
    expect(count).toBe(12);
  });

  it('closing an occurrence BLOCKS new holds (L-132 authority)', async () => {
    const occ = await db.experienceOccurrence.findFirstOrThrow({
      where: { experienceId: expId(), startTime: '10:00' },
      orderBy: { date: 'asc' },
    });
    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { status: OccurrenceStatus.CLOSED },
    });

    const dateKey = occ.date.toISOString().slice(0, 10);
    const refused = await createBookingHold({
      experienceId: expId(),
      date: dateKey,
      timeSlot: '10:00',
      guestCount: 2,
    });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      expect(refused.error.code).toBe('OCCURRENCE_CLOSED');
    }

    // The public slot list shows it as unavailable.
    const slots = await getTimeSlotsForDate(expId(), dateKey);
    expect(slots.success).toBe(true);
    if (slots.success) {
      const closed = slots.data.find((s) => s.timeSlot === '10:00');
      expect(closed?.available).toBe(false);
      expect(closed?.remainingCapacity).toBe(0);
      // 16:00 on the same date is untouched.
      const open = slots.data.find((s) => s.timeSlot === '16:00');
      expect(open?.available).toBe(true);
    }

    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { status: OccurrenceStatus.OPEN },
    });
  });

  it('capacity override CAPS bookings at the occurrence level', async () => {
    const occ = await db.experienceOccurrence.findFirstOrThrow({
      where: { experienceId: expId(), startTime: '16:00' },
      orderBy: { date: 'asc' },
    });
    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { capacityOverride: 2 },
    });

    const dateKey = occ.date.toISOString().slice(0, 10);
    const first = await createBookingHold({
      experienceId: expId(),
      date: dateKey,
      timeSlot: '16:00',
      guestCount: 2,
    });
    expect(first.success).toBe(true);
    // maxCapacity is 8 but the override says 2 — a 3rd seat must refuse.
    const refused = await createBookingHold({
      experienceId: expId(),
      date: dateKey,
      timeSlot: '16:00',
      guestCount: 1,
    });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      expect(refused.error.code).toBe('NO_CAPACITY');
    }
    // The hold row carries the occurrence link.
    if (first.success) {
      const holdRow = await db.booking.findUniqueOrThrow({
        where: { id: first.data.holdId },
        select: { occurrenceId: true },
      });
      expect(holdRow.occurrenceId).toBe(occ.id);
      await db.booking.delete({ where: { id: first.data.holdId } });
    }
    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { capacityOverride: null },
    });
  });

  it('a blocked date refuses holds and empties the public slot list (D3)', async () => {
    const dateKey = inHorizonDateKey(3);
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    await db.blockedDate.create({
      data: { experienceId: expId(), date, reason: 'test blackout' },
    });

    const refused = await createBookingHold({
      experienceId: expId(),
      date: dateKey,
      timeSlot: '10:00',
      guestCount: 1,
    });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      expect(refused.error.code).toBe('DATE_BLOCKED');
    }
    const slots = await getTimeSlotsForDate(expId(), dateKey);
    expect(slots.success).toBe(true);
    if (slots.success) expect(slots.data).toEqual([]);

    // Unblocking restores bookability at read time — status was never
    // mutated (D3: orthogonal sources).
    await db.blockedDate.delete({
      where: { experienceId_date: { experienceId: expId(), date } },
    });
  });

  it('refuses a slot with no availability behind it (INVALID_SLOT)', async () => {
    await expect(
      resolveOccurrence(
        expId(),
        new Date(`${inHorizonDateKey(4)}T00:00:00.000Z`),
        '23:45'
      )
    ).rejects.toMatchObject({ code: 'INVALID_SLOT' });
  });

  it('refuses a PAST date even when an OPEN occurrence row exists', async () => {
    // Stale OPEN rows are never auto-closed by time — the resolve gate
    // must refuse them BEFORE the existing-row short-circuit.
    const pastKey = inHorizonDateKey(-7);
    const pastDate = new Date(`${pastKey}T00:00:00.000Z`);
    await db.experienceOccurrence.create({
      data: {
        experienceId: expId(),
        date: pastDate,
        startTime: '10:00',
        status: OccurrenceStatus.OPEN,
        source: 'RECURRING',
      },
    });

    try {
      await expect(
        resolveOccurrence(expId(), pastDate, '10:00')
      ).rejects.toMatchObject({ code: 'INVALID_SLOT' });

      // Full hold path: refused end to end.
      const refused = await createBookingHold({
        experienceId: expId(),
        date: pastKey,
        timeSlot: '10:00',
        guestCount: 1,
      });
      expect(refused.success).toBe(false);
      if (!refused.success) {
        expect(refused.error.code).toBe('INVALID_SLOT');
      }
    } finally {
      await db.experienceOccurrence.delete({
        where: {
          experienceId_date_startTime: {
            experienceId: expId(),
            date: pastDate,
            startTime: '10:00',
          },
        },
      });
    }
  });

  it('materializes a weekly slot BEYOND the horizon on demand (booking window ≠ horizon)', async () => {
    // The public picker offers 3 months; the 42d horizon only bounds
    // eager generation. A Saturday at ~9-10 weeks must hold fine.
    const farKey = saturdayKeyAfter(63);
    const farDate = new Date(`${farKey}T00:00:00.000Z`);

    const before = await db.experienceOccurrence.findUnique({
      where: {
        experienceId_date_startTime: {
          experienceId: expId(),
          date: farDate,
          startTime: '10:00',
        },
      },
    });
    expect(before).toBeNull(); // beyond eager window — nothing materialized

    const hold = await createBookingHold({
      experienceId: expId(),
      date: farKey,
      timeSlot: '10:00',
      guestCount: 1,
    });
    expect(hold.success).toBe(true);

    // …while a slot with no weekly pattern behind it still refuses out
    // there (the legitimacy gate is slot-based, not horizon-based).
    await expect(
      resolveOccurrence(expId(), farDate, '23:45')
    ).rejects.toMatchObject({ code: 'INVALID_SLOT' });

    if (hold.success) {
      await db.booking.delete({ where: { id: hold.data.holdId } });
    }
    await db.experienceOccurrence.deleteMany({
      where: { experienceId: expId(), date: farDate },
    });
  });

  it('a removed weekly slot stops selling: orphaned RECURRING close, punctual/matching survive', async () => {
    // Punctual pick on a weekday with no weekly slot behind it.
    const punctualKey = inHorizonDateKey(5);
    const punctualDate = new Date(`${punctualKey}T00:00:00.000Z`);
    await createPunctualOccurrences(expId(), [
      { date: punctualDate, startTime: '12:30' },
    ]);

    // Same "future" boundary as the service (Zurich today), or the
    // count assertion goes flaky on Saturdays.
    const futureFrom = zurichTodayAsUTCDate();
    const sixteenBefore = await db.experienceOccurrence.findMany({
      where: {
        experienceId: expId(),
        startTime: '16:00',
        status: OccurrenceStatus.OPEN,
        date: { gte: futureFrom },
      },
      select: { id: true },
    });
    expect(sixteenBefore.length).toBeGreaterThan(0);

    // Owner deactivates the Saturday 16:00 slot.
    await db.availabilitySlot.updateMany({
      where: { experienceId: expId(), startTime: '16:00' },
      data: { isActive: false },
    });

    try {
      const { closed } = await closeOrphanedRecurringOccurrences(expId());
      expect(closed).toBe(sixteenBefore.length);

      const survivors = await db.experienceOccurrence.findMany({
        where: {
          experienceId: expId(),
          status: OccurrenceStatus.OPEN,
          date: { gte: futureFrom },
        },
        select: { startTime: true, source: true },
      });
      // 10:00 recurring rows and the 12:30 punctual pick are untouched.
      expect(survivors.some((s) => s.startTime === '10:00')).toBe(true);
      expect(survivors.some((s) => s.startTime === '12:30')).toBe(true);
      expect(survivors.some((s) => s.startTime === '16:00')).toBe(false);

      // And the closed slot refuses new holds immediately.
      // Strictly future (tomorrow+): a today-row hold could trip the
      // past-date gate instead of the closed gate.
      const sixteenRow = await db.experienceOccurrence.findFirstOrThrow({
        where: {
          experienceId: expId(),
          startTime: '16:00',
          date: { gt: futureFrom },
        },
        orderBy: { date: 'asc' },
      });
      const refused = await createBookingHold({
        experienceId: expId(),
        date: sixteenRow.date.toISOString().slice(0, 10),
        timeSlot: '16:00',
        guestCount: 1,
      });
      expect(refused.success).toBe(false);
      if (!refused.success) {
        expect(refused.error.code).toBe('OCCURRENCE_CLOSED');
      }
    } finally {
      // Restore fixture state for the remaining tests.
      await db.availabilitySlot.updateMany({
        where: { experienceId: expId(), startTime: '16:00' },
        data: { isActive: true },
      });
      await db.experienceOccurrence.updateMany({
        where: { id: { in: sixteenBefore.map((o) => o.id) } },
        data: { status: OccurrenceStatus.OPEN },
      });
      await db.experienceOccurrence.deleteMany({
        where: {
          experienceId: expId(),
          date: punctualDate,
          startTime: '12:30',
        },
      });
    }
  });

  it('a cancelled session can never be resold (occurrence CANCELLED, both paths)', async () => {
    // Path 1: existing materialized occurrence.
    const occ = await db.experienceOccurrence.findFirstOrThrow({
      where: {
        experienceId: expId(),
        startTime: '10:00',
        status: OccurrenceStatus.OPEN,
        date: { gt: zurichTodayAsUTCDate() },
      },
      orderBy: { date: 'asc' },
    });
    await cancelOccurrenceForSlot(expId(), occ.date, '10:00');

    const row = await db.experienceOccurrence.findUniqueOrThrow({
      where: { id: occ.id },
      select: { status: true },
    });
    expect(row.status).toBe(OccurrenceStatus.CANCELLED);
    const refused = await createBookingHold({
      experienceId: expId(),
      date: occ.date.toISOString().slice(0, 10),
      timeSlot: '10:00',
      guestCount: 1,
    });
    expect(refused.success).toBe(false);
    if (!refused.success) {
      expect(refused.error.code).toBe('OCCURRENCE_CLOSED');
    }

    // Path 2: straggler session (no row) on a legitimate weekly slot —
    // without the synthesized CANCELLED row, resolve would re-materialize
    // an OPEN occurrence at the next hold attempt.
    const farKey = saturdayKeyAfter(80);
    const farDate = new Date(`${farKey}T00:00:00.000Z`);
    await cancelOccurrenceForSlot(expId(), farDate, '10:00');
    const synthesized = await db.experienceOccurrence.findUniqueOrThrow({
      where: {
        experienceId_date_startTime: {
          experienceId: expId(),
          date: farDate,
          startTime: '10:00',
        },
      },
      select: { status: true },
    });
    expect(synthesized.status).toBe(OccurrenceStatus.CANCELLED);
    const refusedFar = await createBookingHold({
      experienceId: expId(),
      date: farKey,
      timeSlot: '10:00',
      guestCount: 1,
    });
    expect(refusedFar.success).toBe(false);
    if (!refusedFar.success) {
      expect(refusedFar.error.code).toBe('OCCURRENCE_CLOSED');
    }

    // Restore fixture state.
    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { status: OccurrenceStatus.OPEN },
    });
    await db.experienceOccurrence.deleteMany({
      where: { experienceId: expId(), date: farDate },
    });
  });

  it('kill-switch OFF restores P-04 behavior on a closed occurrence', async () => {
    const occ = await db.experienceOccurrence.findFirstOrThrow({
      where: { experienceId: expId(), startTime: '10:00' },
      orderBy: { date: 'desc' },
    });
    await db.experienceOccurrence.update({
      where: { id: occ.id },
      data: { status: OccurrenceStatus.CLOSED },
    });
    await db.featureFlag.upsert({
      where: { key: 'OCCURRENCE_CAPACITY' },
      create: { key: 'OCCURRENCE_CAPACITY', enabled: false },
      update: { enabled: false },
    });

    try {
      const dateKey = occ.date.toISOString().slice(0, 10);
      const hold = await createBookingHold({
        experienceId: expId(),
        date: dateKey,
        timeSlot: '10:00',
        guestCount: 1,
      });
      // OFF: the closed status does not gate; capacity = maxCapacity.
      expect(hold.success).toBe(true);
      if (hold.success) {
        const row = await db.booking.findUniqueOrThrow({
          where: { id: hold.data.holdId },
          select: { occurrenceId: true },
        });
        // Best-effort stamping still links the occurrence.
        expect(row.occurrenceId).toBe(occ.id);
        await db.booking.delete({ where: { id: hold.data.holdId } });
      }
    } finally {
      await db.featureFlag.upsert({
        where: { key: 'OCCURRENCE_CAPACITY' },
        create: { key: 'OCCURRENCE_CAPACITY', enabled: true },
        update: { enabled: true },
      });
      await db.experienceOccurrence.update({
        where: { id: occ.id },
        data: { status: OccurrenceStatus.OPEN },
      });
    }
  });
});
