/**
 * P-11 (L-102) multi-point scan — verified against a REAL migrated database.
 * The "2 scanners, no collision" guarantee is the compare-and-swap in
 * checkInBooking (updateMany WHERE status=CONFIRMED → count!==1 ⇒
 * ALREADY_CHECKED_IN), which mocked tests can't exercise. Per the delivered
 * design the organizer runs every scan point on its own account, so this
 * fires two concurrent check-ins of the SAME ticket by the SAME owner.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 * Skipped when the env var is absent (the GitHub CI has no Postgres service).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const url = process.env.INVARIANTS_DATABASE_URL;

// The action module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

// checkInBooking calls auth(), rate-limits per user, and revalidatePath.
vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/services/rate-limit.service', () => ({
  API_RATE_LIMIT: { maxRequests: 60, windowMs: 60_000 },
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

type CheckInModule = typeof import('@/server/actions/checkInBooking');
type AuthModule = typeof import('@/server/auth');
type OccurrenceModule =
  typeof import('@/lib/business-rules/occurrence-expansion');

describe.skipIf(!url)('collective scan concurrency (P-11 / L-102)', () => {
  let db: PrismaClient;
  let checkInBooking: CheckInModule['checkInBooking'];
  let auth: AuthModule['auth'];
  const ids: {
    userId?: string;
    wineryId?: string;
    experienceId?: string;
    bookingId?: string;
  } = {};
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  beforeAll(async () => {
    ({ checkInBooking } = await import('@/server/actions/checkInBooking'));
    ({ auth } = await import('@/server/auth'));
    const { zurichTodayAsUTCDate }: OccurrenceModule =
      await import('@/lib/business-rules/occurrence-expansion');
    db = new PrismaClient({ datasourceUrl: url });

    const stamp = Date.now();
    const user = await db.user.create({
      data: {
        email: `collective-scan-${stamp}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;

    const winery = await db.winery.create({
      data: {
        name: `Collective Scan Winery ${stamp}`,
        slug: `collective-scan-${stamp}`,
        description: 'Collective scan test fixture',
        address: 'Route du Test 3',
        commune: 'Sion',
        phone: '+41270000002',
        email: `collective-scan-${stamp}@test.encave.ch`,
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: `acct_test_collective_${stamp}`,
        stripeOnboardingComplete: true,
      },
    });
    ids.wineryId = winery.id;

    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Jardin des Vins',
        slug: `jardin-des-vins-${stamp}`,
        description: 'x'.repeat(120),
        type: 'EVENT',
        duration: 120,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 200,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
        isCollective: true,
      },
    });
    ids.experienceId = experience.id;

    // A CONFIRMED ticket for TODAY (Zurich) — day-mode scanning requires the
    // booking date to be the current Zurich calendar day.
    const booking = await db.booking.create({
      data: {
        reference: `ENC-CSC${stamp.toString().slice(-6)}`,
        visitorEmail: `guest-${stamp}@test.encave.ch`,
        visitorName: 'Collective Guest',
        visitorPhone: '+41790000002',
        experienceId: experience.id,
        wineryId: winery.id,
        date: zurichTodayAsUTCDate(),
        timeSlot: '10:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        status: 'CONFIRMED',
        accessTokenHash: tokenHash,
      },
    });
    ids.bookingId = booking.id;

    vi.mocked(auth).mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        name: 'Collective Owner',
        role: 'WINEMAKER',
        preferredLocale: 'FR',
      },
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

  it('two concurrent scans of the same ticket → exactly 1 CHECKED_IN + 1 ALREADY_CHECKED_IN', async () => {
    const [a, b] = await Promise.all([
      checkInBooking({ token, source: 'scan' }),
      checkInBooking({ token, source: 'scan' }),
    ]);

    const results = [a, b];
    // The winner: a fresh check-in.
    const checkedIn = results.filter(
      (r) => r.success && r.data.code === 'CHECKED_IN'
    );
    // The loser, in EITHER legitimate form:
    //  - read after the winner committed → success + ALREADY_CHECKED_IN (L120)
    //  - lost the CAS (updateMany count 0) → error ALREADY_CHECKED_IN  (L204)
    const already = results.filter(
      (r) =>
        (r.success && r.data.code === 'ALREADY_CHECKED_IN') ||
        (!r.success && r.error.code === 'ALREADY_CHECKED_IN')
    );

    expect(checkedIn).toHaveLength(1); // never two CHECKED_IN = no collision
    expect(already).toHaveLength(1);

    const row = await db.booking.findUnique({
      where: { id: ids.bookingId },
    });
    expect(row?.status).toBe('COMPLETED');
    expect(row?.checkedInAt).not.toBeNull();
  });
});
