/* eslint-disable no-console */
/**
 * ENC-067 — Audit email verification impact
 *
 * After enabling `requireEmailVerification: true` on better-auth, any
 * existing email/password user with `emailVerified=false` will be unable
 * to sign in until they click the verification link.
 *
 * Run before merging ENC-067:
 *   npx tsx scripts/audit-email-verified.ts             # against $DATABASE_URL
 *   DATABASE_URL=<prod> npx tsx scripts/audit-email-verified.ts
 *
 * Outputs counts split by provider:
 *   - OAuth users (Google/Apple)  → already trusted, emailVerified=true expected
 *   - Email/password users        → at risk if emailVerified=false
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const totalUsers = await db.user.count();
  const verified = await db.user.count({ where: { emailVerified: true } });
  const unverified = await db.user.count({ where: { emailVerified: false } });

  const unverifiedWithCredentials = await db.user.count({
    where: {
      emailVerified: false,
      accounts: { some: { providerId: 'credential' } },
    },
  });

  const unverifiedOAuthOnly = await db.user.count({
    where: {
      emailVerified: false,
      accounts: {
        none: { providerId: 'credential' },
      },
    },
  });

  const unverifiedWithBookings = await db.user.count({
    where: {
      emailVerified: false,
      accounts: { some: { providerId: 'credential' } },
      bookings: { some: {} },
    },
  });

  console.log('--- ENC-067 email verification impact audit ---');
  console.log(`Total users:                                  ${totalUsers}`);
  console.log(`  emailVerified=true:                         ${verified}`);
  console.log(`  emailVerified=false:                        ${unverified}`);
  console.log('');
  console.log(`Unverified (email/password — AT RISK):        ${unverifiedWithCredentials}`);
  console.log(`  ...of whom have bookings (high priority):   ${unverifiedWithBookings}`);
  console.log(`Unverified (OAuth-only — should be re-flipped): ${unverifiedOAuthOnly}`);
  console.log('');
  console.log('Sample of at-risk email/password users (max 10):');
  const sample = await db.user.findMany({
    where: {
      emailVerified: false,
      accounts: { some: { providerId: 'credential' } },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.table(
    sample.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      bookings: u._count.bookings,
    }))
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
