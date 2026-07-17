/**
 * P-04 / L-053 one-tap account — attachment proof against a REAL database.
 * The post-payment account creation does NOT link bookings explicitly:
 * the client-booking queries match `visitorEmail` case-insensitively, so
 * a booking made as a guest with a mixed-case email must show up for the
 * lowercase session email of the freshly created account.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 * Skipped when the env var is absent (the GitHub CI has no Postgres service).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

// The query module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

// React 18 has no `cache` export outside the Next.js runtime — pass through.
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));

type ClientBookingQueries =
  typeof import('@/server/queries/client-booking.queries');

describe.skipIf(!url)('client booking attachment (P-04 / L-053)', () => {
  let db: PrismaClient;
  let getClientUpcomingBookings: ClientBookingQueries['getClientUpcomingBookings'];
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  const mixedCaseEmail = `Attachment-${Date.now()}@Example.COM`;
  const sessionEmail = mixedCaseEmail.toLowerCase();

  beforeAll(async () => {
    ({ getClientUpcomingBookings } =
      await import('@/server/queries/client-booking.queries'));
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `attachment-owner-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Attachment Winery ${Date.now()}`,
        slug: `attachment-winery-${Date.now()}`,
        description: 'Booking attachment test fixture',
        address: 'Route du Test 3',
        commune: 'Sion',
        phone: '+41270000002',
        email: 'attachment@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: 'acct_test_attachment',
        stripeOnboardingComplete: true,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Attachment Tasting',
        slug: `attachment-tasting-${Date.now()}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 6,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;

    await db.booking.create({
      data: {
        reference: `ENC-ATTACH${String(Date.now()).slice(-2)}`,
        experienceId: experience.id,
        wineryId: winery.id,
        date: new Date('2027-06-15'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        // Guest booked with a mixed-case email BEFORE creating the account.
        visitorEmail: mixedCaseEmail,
        visitorName: 'John Doe',
        visitorPhone: '+41791234567',
        status: 'CONFIRMED',
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

  it('returns a mixed-case guest booking for the lowercase account email', async () => {
    const bookings = await getClientUpcomingBookings(sessionEmail);

    const attached = bookings.filter((b) => b.visitorEmail === mixedCaseEmail);
    expect(attached).toHaveLength(1);
    expect(attached[0]?.visitorEmail).toBe(mixedCaseEmail);
    expect(attached[0]?.experience.title).toBe('Attachment Tasting');
  });

  it('does not return the booking for a different email', async () => {
    const bookings = await getClientUpcomingBookings(
      `someone-else-${Date.now()}@example.com`
    );
    expect(bookings).toHaveLength(0);
  });
});
