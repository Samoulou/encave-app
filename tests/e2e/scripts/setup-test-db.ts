/**
 * Setup Test Database
 *
 * Prepares a deterministic database for Playwright E2E tests:
 * 1. Reset test data
 * 2. Seed users, wineries, experiences, availability, and bookings
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  TEST_WINERIES,
  TEST_EXPERIENCES,
  TEST_USERS,
} from '../fixtures/test-data';
import { TEST_USERS as AUTH_TEST_USERS } from '../fixtures/auth.fixture';

const prisma = new PrismaClient();

function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toDateOnly(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Current Zurich wall-clock hour as an HH:00 slot — the scan-target
 * session must sit inside the day-J check-in window (start − 2h → end +
 * 2h, Zurich wall clock) whatever hour CI runs at.
 */
function zurichNowSlot(): string {
  // formatToParts, NOT format(): fr-CH renders '06 h' which breaks the
  // HH:mm timeSlot schema.
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Europe/Zurich',
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'hour')?.value;
  if (!hour) throw new Error('Could not resolve the Zurich hour');
  return `${hour.padStart(2, '0')}:00`;
}

const WINERY_COORDINATES: Record<
  string,
  { latitude: number; longitude: number }
> = {
  'domaine-du-test': { latitude: 46.5197, longitude: 6.6323 },
  'domaine-sans-stripe': { latitude: 46.2044, longitude: 6.1432 },
  'cave-des-tests': { latitude: 46.4312, longitude: 6.9107 },
  'auth-test-winery': { latitude: 46.2333, longitude: 7.3667 },
};

async function main() {
  console.log('Cleaning E2E test database...');

  // P-16 surfaces first (loose/no FKs to the core graph). The gift ledger
  // (gift_card_transactions) is append-only by DB trigger — NEVER
  // deleteMany it; cards accumulate across local runs by design, specs use
  // per-run unique emails/codes.
  await prisma.requestOffer.deleteMany();
  await prisma.request.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.emailLog.deleteMany();

  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.winery.deleteMany();

  const testUserIds = Object.values(TEST_USERS).map((u) => u.id);
  const authUserEmails = Object.values(AUTH_TEST_USERS).map((u) => u.email);

  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { in: testUserIds } },
        { email: { in: authUserEmails } },
        // Accounts registered by the winery-onboarding spec (P-16).
        { email: { contains: 'e2e-onboarding' } },
      ],
    },
  });

  console.log('Seeding E2E users...');

  for (const user of Object.values(TEST_USERS)) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'WINEMAKER',
        // Pre-seeded fixtures stand in for existing, already-onboarded
        // accounts (like the emailVerified backfill migration does for
        // real pre-existing users) — never for the unverified state a
        // fresh sign-up starts in, which no E2E flow here exercises.
        emailVerified: true,
      },
    });
  }

  const roleMapping: Record<string, 'CLIENT' | 'WINEMAKER' | 'ADMIN'> = {
    guest: 'CLIENT',
    winery_owner: 'WINEMAKER',
    admin: 'ADMIN',
  };

  let authWineryId: string | null = null;

  for (const [key, user] of Object.entries(AUTH_TEST_USERS)) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const role = roleMapping[user.role] || 'CLIENT';

    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role,
        // See the WINEMAKER seed above — these fixtures represent
        // already-existing verified accounts, not fresh sign-ups.
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        userId: createdUser.id,
        providerId: 'credential',
        accountId: user.email,
        password: hashedPassword,
      },
    });

    if (user.role === 'winery_owner') {
      const isPending = key === 'winemakerPending';
      const suffix = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const wineryName =
        key === 'wineryOwner' ? 'Auth Test Winery' : `E2E ${user.name} Winery`;

      const createdWinery = await prisma.winery.create({
        data: {
          // Fixed cuid-shaped id for the main auth winery: ISR pages
          // (/sur-mesure select, fiches) embed winery ids — a reseed must
          // not orphan them, and the request schema validates cuids.
          ...(key === 'wineryOwner'
            ? { id: 'ce2eauthtestwinery00000001' }
            : {}),
          name: wineryName,
          slug:
            key === 'wineryOwner' ? 'auth-test-winery' : `e2e-${suffix}-winery`,
          description:
            'A test winery for authentication E2E tests with required dashboard states.',
          commune: 'Sion',
          address: '100 Route des Tests, 1950 Sion',
          latitude: WINERY_COORDINATES['auth-test-winery'].latitude,
          longitude: WINERY_COORDINATES['auth-test-winery'].longitude,
          phone: '+41 27 123 45 67',
          email: user.email,
          latitude: 46.2331,
          longitude: 7.3606,
          userId: createdUser.id,
          stripeAccountId: isPending ? null : `acct_${key}`,
          stripeOnboardingComplete: !isPending,
          stripeDetailsSubmitted: !isPending,
          status: isPending ? 'PENDING' : 'VERIFIED',
          galleryImages: isPending
            ? undefined
            : {
                create: [
                  {
                    url: `/images/test/e2e-${suffix}-winery.jpg`,
                    order: 0,
                  },
                ],
              },
        },
      });
      if (key === 'wineryOwner') {
        authWineryId = createdWinery.id;
      }
    }
  }

  console.log('Seeding E2E wineries...');

  for (const winery of Object.values(TEST_WINERIES)) {
    await prisma.winery.create({
      data: {
        id: winery.id,
        name: winery.name,
        slug: winery.slug,
        description: winery.description,
        commune: winery.commune,
        address: winery.address,
        latitude: WINERY_COORDINATES[winery.slug]?.latitude ?? 46.2333,
        longitude: WINERY_COORDINATES[winery.slug]?.longitude ?? 7.3667,
        phone: winery.phone,
        email: winery.email,
        latitude: 46.5197,
        longitude: 6.6323,
        userId: winery.userId,
        stripeAccountId: winery.stripeConnected ? winery.stripeAccountId : null,
        stripeOnboardingComplete: winery.stripeConnected,
        stripeDetailsSubmitted: winery.stripeConnected,
        status: 'VERIFIED',
        galleryImages: winery.stripeConnected
          ? {
              create: [
                {
                  url: `/images/test/${winery.slug}.jpg`,
                  order: 0,
                },
              ],
            }
          : undefined,
      },
    });
  }

  console.log('Seeding E2E experiences...');

  for (const experience of Object.values(TEST_EXPERIENCES)) {
    await prisma.experience.create({
      data: {
        id: experience.id,
        slug: experience.slug,
        title: experience.title,
        description: experience.description,
        type: experience.type,
        price: experience.price,
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        duration: experience.duration,
        coverPhoto: experience.coverPhoto,
        wineryId: experience.wineryId,
        status: 'PUBLISHED',
        availabilitySlots: {
          create: experience.availabilitySlots.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        },
      },
    });
  }

  console.log('Seeding E2E bookings...');

  const bookings = [
    {
      id: 'test-booking-client-a-upcoming',
      reference: 'ENC-E2E001',
      visitor: AUTH_TEST_USERS.clientA,
      experience: TEST_EXPERIENCES.wineTasting,
      date: toDateOnly(7),
      timeSlot: '10:00',
      guestCount: 2,
      status: 'CONFIRMED' as const,
      token: 'token-client-a-upcoming',
    },
    {
      id: 'test-booking-client-a-soon',
      reference: 'ENC-E2E002',
      visitor: AUTH_TEST_USERS.clientA,
      experience: TEST_EXPERIENCES.cellarVisit,
      date: toDateOnly(1),
      timeSlot: '14:00',
      guestCount: 4,
      status: 'CONFIRMED' as const,
      token: 'token-client-a-soon',
    },
    {
      id: 'test-booking-client-b-upcoming',
      reference: 'ENC-E2E003',
      visitor: AUTH_TEST_USERS.clientB,
      experience: TEST_EXPERIENCES.lowCapacity,
      date: toDateOnly(8),
      timeSlot: '11:00',
      guestCount: 2,
      status: 'CONFIRMED' as const,
      token: 'token-client-b-upcoming',
    },
    {
      id: 'test-booking-client-a-cancelled',
      reference: 'ENC-E2E004',
      visitor: AUTH_TEST_USERS.clientA,
      experience: TEST_EXPERIENCES.wineTasting,
      date: toDateOnly(-7),
      timeSlot: '10:00',
      guestCount: 2,
      status: 'CANCELLED_BY_CLIENT' as const,
      token: 'token-client-a-cancelled',
    },
  ];

  for (const booking of bookings) {
    const totalPrice = booking.experience.price * booking.guestCount;
    const platformFee = Math.round(totalPrice * 0.12);
    const winery =
      Object.values(TEST_WINERIES).find(
        (candidate) => candidate.id === booking.experience.wineryId
      ) ?? TEST_WINERIES.activeWinery;

    await prisma.booking.create({
      data: {
        id: booking.id,
        reference: booking.reference,
        visitorName: booking.visitor.name,
        visitorEmail: booking.visitor.email,
        visitorPhone: '+41 79 000 00 00',
        experienceId: booking.experience.id,
        wineryId: winery.id,
        date: booking.date,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        totalPrice,
        platformFee,
        wineryPayout: totalPrice - platformFee,
        status: booking.status,
        accessTokenHash: hashAccessToken(booking.token),
        cancelledAt:
          booking.status === 'CANCELLED_BY_CLIENT' ? new Date() : null,
      },
    });
  }

  console.log('Seeding P-16 fixtures (flags, scan & cancellation targets)...');

  // Money flags exercised by the gift/request A→Z journeys. The other
  // flags keep their registry default (OFF) — the pre-existing specs are
  // the flag-OFF proof required by the delivery-plan DoD.
  for (const key of ['GIFT_CARDS', 'REQUESTS']) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { enabled: true },
      create: { key, enabled: true },
    });
  }

  if (!authWineryId) {
    throw new Error('auth-test-winery missing — P-16 fixtures need it');
  }

  // Experience owned by the auth wineryOwner so the scan spec can log in
  // as that account and check the visitor in. FIXED id, cuid-shaped: the
  // fiche is ISR-cached with the id embedded (a reseed must not orphan
  // it), and the gift preview schema validates experienceId as a cuid.
  const authExperience = await prisma.experience.create({
    data: {
      id: 'ce2eauthwinerytasting00001',
      slug: 'auth-winery-tasting',
      title: 'Auth Winery Tasting',
      description:
        'Experience owned by the auth-test winery for scan and cancellation E2E journeys.',
      type: 'TASTING',
      price: 4500,
      minCapacity: 1,
      // Generous capacity: several journeys (gift ×2, a11y checkout) book
      // this experience in one run, and CI retries stack 10-min holds.
      maxCapacity: 30,
      duration: 90,
      coverPhoto: '/images/test/domaine-du-test.jpg',
      wineryId: authWineryId,
      status: 'PUBLISHED',
      availabilitySlots: {
        create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '10:00',
          endTime: '11:30',
        })),
      },
    },
  });

  // Scan target: CONFIRMED today, slotted on the CURRENT Zurich hour so
  // the check-in window is always open when the spec runs. The booking is
  // attached to a real occurrence — legacy (occurrence-less) sessions
  // render the sheet read-only (canEdit false).
  const scanSlot = zurichNowSlot();
  const scanOccurrence = await prisma.experienceOccurrence.create({
    data: {
      experienceId: authExperience.id,
      date: toDateOnly(0),
      startTime: scanSlot,
      source: 'PUNCTUAL',
    },
  });
  // No fixed id: the check-in actions validate bookingId as a cuid — the
  // spec resolves this booking by its reference.
  await prisma.booking.create({
    data: {
      reference: 'ENC-E2E101',
      visitorName: 'Scan Target Visitor',
      visitorEmail: 'scan-target@test.example.com',
      visitorPhone: '+41 79 000 00 01',
      experienceId: authExperience.id,
      wineryId: authWineryId,
      occurrenceId: scanOccurrence.id,
      date: toDateOnly(0),
      timeSlot: scanSlot,
      guestCount: 2,
      totalPrice: 9000,
      platformFee: 1080,
      wineryPayout: 7920,
      status: 'CONFIRMED',
      accessTokenHash: hashAccessToken('token-scan-target'),
    },
  });

  // Cancellation target: CONFIRMED at +7d with an E2E payment intent —
  // processRefund resolves `e2e_…` intents synthetically (P-16), so the
  // full cancel-with-refund path runs without Stripe.
  await prisma.booking.create({
    data: {
      id: 'test-booking-cancel-target',
      reference: 'ENC-E2E102',
      visitorName: 'Cancel Target Visitor',
      visitorEmail: 'cancel-target@test.example.com',
      visitorPhone: '+41 79 000 00 02',
      experienceId: authExperience.id,
      wineryId: authWineryId,
      date: toDateOnly(7),
      timeSlot: '10:00',
      guestCount: 2,
      totalPrice: 9000,
      platformFee: 1080,
      wineryPayout: 7920,
      status: 'CONFIRMED',
      stripePaymentIntentId: 'e2e_pi_cancel_target',
      accessTokenHash: hashAccessToken('token-cancel-target'),
    },
  });

  console.log('E2E database ready');
  console.log(`  - ${Object.keys(TEST_USERS).length} winemaker users`);
  console.log(`  - ${Object.keys(AUTH_TEST_USERS).length} auth users`);
  console.log(`  - ${Object.keys(TEST_WINERIES).length} wineries`);
  console.log(`  - ${Object.keys(TEST_EXPERIENCES).length} experiences`);
  console.log(`  - ${bookings.length} bookings`);
}

main()
  .catch((error) => {
    console.error('E2E setup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
