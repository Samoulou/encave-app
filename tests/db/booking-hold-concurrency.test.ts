/**
 * P-04 hold concurrency — verified against a REAL migrated database
 * (Serializable isolation + P2034 retry are invisible to mocked tests).
 * This is the seed of the future k6 load scenario (plan P-04 §5).
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 * Skipped when the env var is absent (the GitHub CI has no Postgres service).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

// The action module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

// createBookingHold rate-limits per IP via next/headers, which throws
// outside a Next.js request scope.
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': `198.51.100.${process.pid % 250}` }),
}));

type CheckoutActions = typeof import('@/server/actions/checkout');

describe.skipIf(!url)('booking hold concurrency (P-04 / L-050)', () => {
  let db: PrismaClient;
  let createBookingHold: CheckoutActions['createBookingHold'];
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};

  beforeAll(async () => {
    ({ createBookingHold } = await import('@/server/actions/checkout'));
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `hold-concurrency-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Hold Concurrency Winery ${Date.now()}`,
        slug: `hold-concurrency-${Date.now()}`,
        description: 'Hold concurrency test fixture',
        address: 'Route du Test 2',
        commune: 'Sion',
        phone: '+41270000001',
        email: 'hold-concurrency@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: 'acct_test_hold_concurrency',
        stripeOnboardingComplete: true,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Hold Concurrency Tasting',
        slug: `hold-concurrency-tasting-${Date.now()}`,
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

  function expId(): string {
    if (!ids.experienceId) throw new Error('experienceId fixture missing');
    return ids.experienceId;
  }

  it('two concurrent holds on 3 remaining seats → exactly 1 success, 1 clean NO_CAPACITY', async () => {
    const input = (timeSlot: string) => ({
      experienceId: expId(),
      date: '2026-11-25',
      timeSlot,
      guestCount: 2,
    });

    const [a, b] = await Promise.all([
      createBookingHold(input('10:00')),
      createBookingHold(input('10:00')),
    ]);

    const results = [a, b];
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    if (failure && !failure.success) {
      expect(failure.error.code).toBe('NO_CAPACITY');
    }

    // k6-style invariant: live holds never exceed capacity.
    const sum = await db.booking.aggregate({
      where: {
        experienceId: expId(),
        date: new Date('2026-11-25'),
        timeSlot: '10:00',
        status: 'PENDING_PAYMENT',
        expiresAt: { gt: new Date() },
      },
      _sum: { guestCount: true },
    });
    expect(sum._sum.guestCount).toBe(2);
  });

  it('an expired hold releases its seats logically (no cron needed)', async () => {
    const input = {
      experienceId: expId(),
      date: '2026-11-26',
      timeSlot: '14:00',
      guestCount: 2,
    };

    const first = await createBookingHold(input);
    expect(first.success).toBe(true);

    // 2 held + 2 requested > 3 seats → refused while the hold is alive.
    const blocked = await createBookingHold(input);
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.error.code).toBe('NO_CAPACITY');
    }

    if (first.success) {
      await db.booking.update({
        where: { id: first.data.holdId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
    }

    // Same slot, hold now expired → seats are free again immediately.
    const after = await createBookingHold(input);
    expect(after.success).toBe(true);
  });
});
