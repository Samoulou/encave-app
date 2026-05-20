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

const WINERY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'domaine-du-test': { latitude: 46.5197, longitude: 6.6323 },
  'domaine-sans-stripe': { latitude: 46.2044, longitude: 6.1432 },
  'cave-des-tests': { latitude: 46.4312, longitude: 6.9107 },
  'auth-test-winery': { latitude: 46.2333, longitude: 7.3667 },
};

async function main() {
  console.log('Cleaning E2E test database...');

  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.winery.deleteMany();

  const testUserIds = Object.values(TEST_USERS).map((u) => u.id);
  const authUserEmails = Object.values(AUTH_TEST_USERS).map((u) => u.email);

  await prisma.user.deleteMany({
    where: {
      OR: [{ id: { in: testUserIds } }, { email: { in: authUserEmails } }],
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
      },
    });
  }

  const roleMapping: Record<string, 'CLIENT' | 'WINEMAKER' | 'ADMIN'> = {
    guest: 'CLIENT',
    winery_owner: 'WINEMAKER',
    admin: 'ADMIN',
  };

  for (const [key, user] of Object.entries(AUTH_TEST_USERS)) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const role = roleMapping[user.role] || 'CLIENT';

    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role,
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

      await prisma.winery.create({
        data: {
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
