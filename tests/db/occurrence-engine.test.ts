/**
 * P-05 occurrence engine — against a REAL migrated database.
 * Covers the US-101 generation count, idempotence, the L-132 authority
 * (close/override DO affect booking), the D3 blackout gate and the
 * kill-switch parity (flag OFF = P-04 behavior).
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, OccurrenceStatus } from '@prisma/client';

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

describe.skipIf(!url)('occurrence engine (P-05 / L-024, ADR-0002)', () => {
  let db: PrismaClient;
  let generateOccurrences: OccurrenceService['generateOccurrences'];
  let resolveOccurrence: OccurrenceService['resolveOccurrence'];
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
    ({ generateOccurrences, resolveOccurrence } =
      await import('@/server/services/occurrence.service'));
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
