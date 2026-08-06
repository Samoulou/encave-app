/**
 * Seeds the dedicated oversell target for the k6 load scenario (P-16 /
 * L-180): one VERIFIED winery + one PUBLISHED 3-seat experience with weekly
 * availability, isolated from any other seed data. Prints the k6 target as
 * JSON on stdout — the workflow feeds it to `k6 run` via env vars.
 *
 * Usage: DATABASE_URL=postgresql://... npx tsx scripts/k6-seed-oversell.ts
 */
import { PrismaClient } from '@prisma/client';

import { assertLocalDbUrl } from '../tests/helpers/assert-local-db';

// Writes a VERIFIED winery + PUBLISHED bookable experience — local DBs only
// (a stray staging DATABASE_URL would publish a fake experience there).
assertLocalDbUrl(process.env.DATABASE_URL || '');

const db = new PrismaClient();

const CAPACITY = 3;
const TIME_SLOT = '10:00';

async function main() {
  const stamp = Date.now();

  const user = await db.user.create({
    data: {
      email: `k6-oversell-${stamp}@test.encave.ch`,
      role: 'WINEMAKER',
    },
  });
  const winery = await db.winery.create({
    data: {
      name: `K6 Oversell Winery ${stamp}`,
      slug: `k6-oversell-${stamp}`,
      description: 'k6 oversell load-test fixture',
      address: 'Route du Test 3',
      commune: 'Sion',
      phone: '+41270000002',
      email: `k6-oversell-${stamp}@test.encave.ch`,
      userId: user.id,
      status: 'VERIFIED',
      stripeAccountId: `acct_test_k6_${stamp}`,
      stripeOnboardingComplete: true,
    },
  });
  const experience = await db.experience.create({
    data: {
      wineryId: winery.id,
      title: 'K6 Oversell Tasting',
      slug: `k6-oversell-tasting-${stamp}`,
      description: 'x'.repeat(120),
      type: 'TASTING',
      duration: 60,
      price: 2500,
      minCapacity: 1,
      maxCapacity: CAPACITY,
      coverPhoto: 'https://example.com/cover.jpg',
      status: 'PUBLISHED',
    },
  });
  // Active weekly slot on every weekday so any in-horizon date resolves
  // (P-05 legitimacy: holds on arbitrary (date, time) pairs are refused).
  await db.availabilitySlot.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      experienceId: experience.id,
      dayOfWeek,
      startTime: TIME_SLOT,
      endTime: '11:00',
      isActive: true,
    })),
  });

  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Single stdout line, consumed by the workflow via jq.
  process.stdout.write(
    `${JSON.stringify({
      experienceId: experience.id,
      date,
      timeSlot: TIME_SLOT,
      capacity: CAPACITY,
    })}\n`
  );
}

main()
  .catch((error) => {
    process.stderr.write(`k6-seed-oversell failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
