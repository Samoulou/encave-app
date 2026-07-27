const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config({ path: '.env.local' });

const RECOVERABLE_MIGRATION = '20260512000000_add_booking_checked_in_at';

// P-06: static generation fans out build workers — without a bounded
// pool the ~270-page prerender exhausts Postgres/pgbouncer connections
// (P2024/'too many clients'). Warn loudly instead of relying on tribal
// knowledge in docs/plans/P-06-performance.md.
if (
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('connection_limit')
) {
  console.warn(
    '[deploy-migrations] WARNING: DATABASE_URL has no connection_limit — ' +
      'static generation may exhaust the connection pool. ' +
      'Add ?connection_limit=5&pool_timeout=60 to the pooled URL.'
  );
}

function runPrisma(args) {
  return spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  });
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function canMarkCheckedInMigrationApplied() {
  const prisma = new PrismaClient();
  try {
    const columns = await prisma.$queryRaw`
      select column_name
      from information_schema.columns
      where table_name = 'bookings'
        and column_name = 'checkedInAt'
    `;
    const indexes = await prisma.$queryRaw`
      select indexname
      from pg_indexes
      where tablename = 'bookings'
        and indexname = 'bookings_experienceId_date_timeSlot_status_idx'
    `;

    return columns.length > 0 && indexes.length > 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // CI has no reachable database; Vercel deployments never set this.
  if (process.env.SKIP_DB_MIGRATIONS === '1') {
    console.log('SKIP_DB_MIGRATIONS=1 — skipping prisma migrate deploy.');
    return;
  }

  // `prisma migrate deploy` uses the DIRECT (non-pooled) connection and loads
  // the datasource config, so it hard-fails (P1012) when DIRECT_URL is unset —
  // e.g. a Vercel preview build whose env only carries the pooled DATABASE_URL.
  // Migrations cannot run without a direct connection, so skip them there
  // (`next build` itself only needs DATABASE_URL). Production MUST have
  // DIRECT_URL configured — fail loud rather than silently shipping unmigrated.
  if (!process.env.DIRECT_URL) {
    if (process.env.VERCEL_ENV === 'production') {
      console.error(
        '[deploy-migrations] DIRECT_URL is required in production — refusing to skip migrations.'
      );
      process.exit(1);
    }
    console.warn(
      '[deploy-migrations] DIRECT_URL not set — skipping prisma migrate deploy ' +
        '(no direct connection; preview/DB-less build). Apply migrations from an ' +
        'environment where DIRECT_URL is configured.'
    );
    return;
  }

  const deploy = runPrisma(['migrate', 'deploy']);
  printResult(deploy);

  if (deploy.status === 0) return;

  const output = `${deploy.stdout || ''}\n${deploy.stderr || ''}`;
  const isRecoverable =
    (output.includes('P3018') || output.includes('P3009')) &&
    output.includes(RECOVERABLE_MIGRATION);

  if (!isRecoverable) {
    process.exit(deploy.status || 1);
  }

  if (!(await canMarkCheckedInMigrationApplied())) {
    console.error(
      `Refusing to resolve ${RECOVERABLE_MIGRATION}: expected schema artifacts are missing.`
    );
    process.exit(1);
  }

  const resolve = runPrisma([
    'migrate',
    'resolve',
    '--applied',
    RECOVERABLE_MIGRATION,
  ]);
  printResult(resolve);

  if (resolve.status !== 0) {
    process.exit(resolve.status || 1);
  }

  const retry = runPrisma(['migrate', 'deploy']);
  printResult(retry);
  process.exit(retry.status || 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
