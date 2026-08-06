/**
 * Post-run SQL invariant for the k6 oversell scenario (P-16 / L-180): the
 * k6 threshold counts HTTP successes, THIS is the ground truth — live
 * seats reserved in the database never exceed the slot capacity, whatever
 * the HTTP layer reported.
 *
 * Usage:
 *   DATABASE_URL=... K6_EXPERIENCE_ID=... K6_DATE=YYYY-MM-DD \
 *   K6_TIME_SLOT=10:00 K6_CAPACITY=3 npx tsx scripts/k6-assert-invariants.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const experienceId = process.env.K6_EXPERIENCE_ID;
  const date = process.env.K6_DATE;
  const timeSlot = process.env.K6_TIME_SLOT;
  const capacity = Number(process.env.K6_CAPACITY || '3');
  if (!experienceId || !date || !timeSlot) {
    throw new Error('K6_EXPERIENCE_ID, K6_DATE and K6_TIME_SLOT are required');
  }

  const sum = await db.booking.aggregate({
    where: {
      experienceId,
      date: new Date(`${date}T00:00:00.000Z`),
      timeSlot,
      OR: [
        { status: 'PENDING_PAYMENT', expiresAt: { gt: new Date() } },
        { status: 'CONFIRMED' },
      ],
    },
    _sum: { guestCount: true },
  });
  const reserved = sum._sum.guestCount ?? 0;

  process.stdout.write(
    `oversell invariant: ${reserved} live seat(s) reserved / capacity ${capacity}\n`
  );
  if (reserved > capacity) {
    throw new Error(
      `OVERSELL: ${reserved} seats reserved on a ${capacity}-seat slot`
    );
  }
}

main()
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
