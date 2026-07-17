/**
 * Creates the local invariants database and applies migrations, so the
 * tests/db suites can run locally with one command:
 *
 *   npm run test:db:start                # Docker Postgres on :5433
 *   npm run test:db:invariants:setup     # this script
 *   npm run test:db:invariants:local     # vitest run tests/db
 *
 * The invariants suites need a `prisma migrate deploy` database (CHECK
 * constraints + triggers live in migrations); the e2e database on the same
 * container is `db push`-only, hence a SECOND database (default
 * `encave_invariants`) instead of reusing `encave_test`.
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

import { assertLocalDbUrl } from '../../helpers/assert-local-db';

const DEFAULT_URL =
  'postgresql://postgres:postgres@localhost:5433/encave_invariants';

async function main() {
  const url = process.env.INVARIANTS_DATABASE_URL || DEFAULT_URL;
  assertLocalDbUrl(url, 'INVARIANTS_DATABASE_URL');

  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!/^[a-z_][a-z0-9_]*$/i.test(dbName)) {
    throw new Error(`Unsafe database name "${dbName}" — aborting.`);
  }

  // CREATE DATABASE must run from another database on the same server.
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: maintenance.toString() });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
    console.log(`Created database ${dbName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('42P04') && !message.includes('already exists')) {
      throw error;
    }
    console.log(`Database ${dbName} already exists`);
  } finally {
    await admin.$disconnect();
  }

  console.log(`Applying migrations to ${dbName}...`);
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
  console.log('Invariants database ready.');
  console.log('Run the suites with: npm run test:db:invariants:local');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
