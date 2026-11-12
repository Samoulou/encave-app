/**
 * Which bookings hold a seat — verified against a REAL migrated database
 * through the REAL hold engine (`createBookingHold`: Serializable
 * transaction + the shared `activeCapacityBookingWhere` predicate).
 *
 *  - a checked-in (COMPLETED) or NO_SHOW booking keeps its seat: scanning
 *    arrivals must never re-open a full session (oversell);
 *  - a cancelled booking releases it;
 *  - a session that has already started (Zurich wall clock) is not for sale,
 *    whatever its remaining capacity.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 * Skipped when the env var is absent (the GitHub CI has no Postgres service).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, type BookingStatus } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

// The action module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

// createBookingHold rate-limits per IP via next/headers, which throws
// outside a Next.js request scope. The budget itself is not under test.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '198.51.100.251' }),
}));
vi.mock('@/server/services/rate-limit.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/server/services/rate-limit.service')
    >();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  };
});

type CheckoutActions = typeof import('@/server/actions/checkout');
type OccurrenceModule =
  typeof import('@/lib/business-rules/occurrence-expansion');

describe.skipIf(!url)('seat-holding statuses + slot-start cutoff', () => {
  let db: PrismaClient;
  let createBookingHold: CheckoutActions['createBookingHold'];
  let zurichTodayKey: string;
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  let sequence = 0;

  function fixture(): { experienceId: string; wineryId: string } {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    return { experienceId: ids.experienceId, wineryId: ids.wineryId };
  }

  function inHorizonDateKey(daysFromNow: number): string {
    const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  /** A 2-guest booking in `status` on (dateKey, 10:00) — 3 seats total. */
  async function seedBooking(
    dateKey: string,
    status: BookingStatus
  ): Promise<string> {
    const { experienceId, wineryId } = fixture();
    sequence += 1;
    const stamp = `${Date.now().toString().slice(-5)}${sequence}`;
    const booking = await db.booking.create({
      data: {
        reference: `ENC-CS${stamp}`,
        visitorEmail: `capacity-guest-${stamp}@test.encave.ch`,
        visitorName: 'Capacity Guest',
        visitorPhone: '+41790000004',
        experienceId,
        wineryId,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        timeSlot: '10:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 500,
        wineryPayout: 4500,
        status,
      },
    });
    return booking.id;
  }

  beforeAll(async () => {
    ({ createBookingHold } = await import('@/server/actions/checkout'));
    const { zurichTodayAsUTCDate }: OccurrenceModule =
      await import('@/lib/business-rules/occurrence-expansion');
    zurichTodayKey = zurichTodayAsUTCDate().toISOString().slice(0, 10);
    db = new PrismaClient({ datasourceUrl: url });

    const stamp = Date.now();
    const user = await db.user.create({
      data: {
        email: `capacity-statuses-${stamp}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Capacity Statuses Winery ${stamp}`,
        slug: `capacity-statuses-${stamp}`,
        description: 'Capacity statuses test fixture',
        address: 'Route du Test 5',
        commune: 'Sion',
        phone: '+41270000005',
        email: `capacity-statuses-${stamp}@test.encave.ch`,
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: `acct_test_capacity_${stamp}`,
        stripeOnboardingComplete: true,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Capacity Statuses Tasting',
        slug: `capacity-statuses-${stamp}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 3,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;
    // Legitimacy backing (P-05): an active weekly 10:00 slot every weekday.
    await db.availabilitySlot.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        experienceId: experience.id,
        dayOfWeek,
        startTime: '10:00',
        endTime: '11:00',
        isActive: true,
      })),
    });
  });

  afterAll(async () => {
    // Booking→Winery/Experience are Restrict — bookings go first, then the
    // user delete cascades winery + experience.
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

  it.each(['COMPLETED', 'NO_SHOW'] as const)(
    'a %s booking keeps its seats — a full session is not re-opened',
    async (status) => {
      const dateKey = inHorizonDateKey(status === 'COMPLETED' ? 6 : 7);
      await seedBooking(dateKey, status);

      // 2 seats taken + 2 requested > 3 → refused.
      const blocked = await createBookingHold({
        experienceId: fixture().experienceId,
        date: dateKey,
        timeSlot: '10:00',
        guestCount: 2,
      });
      expect(blocked.success).toBe(false);
      if (!blocked.success) {
        expect(blocked.error.code).toBe('NO_CAPACITY');
      }

      // The genuinely free seat is still sellable.
      const lastSeat = await createBookingHold({
        experienceId: fixture().experienceId,
        date: dateKey,
        timeSlot: '10:00',
        guestCount: 1,
      });
      expect(lastSeat.success).toBe(true);
    }
  );

  it('a cancelled booking releases its seats', async () => {
    const dateKey = inHorizonDateKey(8);
    await seedBooking(dateKey, 'CANCELLED_BY_CLIENT');

    const hold = await createBookingHold({
      experienceId: fixture().experienceId,
      date: dateKey,
      timeSlot: '10:00',
      guestCount: 3,
    });
    expect(hold.success).toBe(true);
  });

  it('reverting a check-in (COMPLETED → CONFIRMED) is capacity-neutral', async () => {
    const dateKey = inHorizonDateKey(9);
    const bookingId = await seedBooking(dateKey, 'COMPLETED');
    const request = {
      experienceId: fixture().experienceId,
      date: dateKey,
      timeSlot: '10:00',
      guestCount: 2,
    };

    const before = await createBookingHold(request);
    await db.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', checkedInAt: null },
    });
    const after = await createBookingHold(request);

    // Same answer on both sides of the revert: the seat was never free.
    expect(before.success).toBe(false);
    expect(after.success).toBe(false);
  });

  it('refuses a hold on a session that has already started today, even with every seat free', async () => {
    // 00:00 Zurich today has started whenever this runs; the cutoff is
    // checked before slot legitimacy, so no weekly slot is needed.
    const result = await createBookingHold({
      experienceId: fixture().experienceId,
      date: zurichTodayKey,
      timeSlot: '00:00',
      guestCount: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_SLOT');
    }
    const rows = await db.booking.count({
      where: {
        experienceId: fixture().experienceId,
        date: new Date(`${zurichTodayKey}T00:00:00.000Z`),
      },
    });
    expect(rows).toBe(0);
  });
});
