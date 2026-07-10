/**
 * P-06 (L-207) — query plans against a REAL migrated database.
 *
 * Asserts that the hot public reads use the indexes the migration
 * created (trigram GIN for ILIKE search + visitorEmail, composite
 * booking indexes, the pre-existing occurrence [date,status]) instead
 * of sequential scans.
 *
 * Small-table trap: on a near-empty database Postgres prefers seq scans
 * even when an index exists — `enable_seqscan = off` per session plus an
 * ANALYZE force the planner to reveal whether the index is USABLE,
 * which is what these tests pin down.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 * (base created via `prisma migrate deploy` — db push lacks the raw objects)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

type PlanNode = {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
};

function walkPlan(node: PlanNode, visit: (n: PlanNode) => void): void {
  visit(node);
  for (const child of node.Plans ?? []) walkPlan(child, visit);
}

function collectNodes(plan: PlanNode): PlanNode[] {
  const nodes: PlanNode[] = [];
  walkPlan(plan, (n) => nodes.push(n));
  return nodes;
}

describe.skipIf(!url)('query plans (P-06 / L-207)', () => {
  let db: PrismaClient;

  async function explain(sql: string): Promise<PlanNode> {
    const rows = (await db.$queryRawUnsafe(
      `EXPLAIN (FORMAT JSON) ${sql}`
    )) as Array<{ 'QUERY PLAN': Array<{ Plan: PlanNode }> }>;
    const plan = rows[0]?.['QUERY PLAN']?.[0]?.Plan;
    if (!plan) throw new Error('no plan returned');
    return plan;
  }

  function expectIndexOn(
    plan: PlanNode,
    relation: string,
    indexPattern: RegExp
  ) {
    const nodes = collectNodes(plan);
    const seqScans = nodes.filter(
      (n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === relation
    );
    expect(
      seqScans,
      `Seq Scan on ${relation} — expected an index matching ${indexPattern}`
    ).toEqual([]);
    const indexNodes = nodes.filter(
      (n) => n['Index Name'] && indexPattern.test(n['Index Name'] ?? '')
    );
    expect(
      indexNodes.length,
      `no index node matching ${indexPattern} on ${relation} (got: ${nodes
        .map((n) => n['Index Name'])
        .filter(Boolean)
        .join(', ')})`
    ).toBeGreaterThan(0);
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    // Force the planner to prove index USABILITY on tiny test tables.
    await db.$executeRawUnsafe('SET enable_seqscan = off');
    await db.$executeRawUnsafe(
      'ANALYZE experiences, wineries, bookings, experience_occurrences'
    );
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("catalogue search: experiences title/description ILIKE '%…%' → trigram GIN", async () => {
    const plan = await explain(
      `SELECT id FROM experiences WHERE title ILIKE '%pinot%' OR description ILIKE '%pinot%'`
    );
    expectIndexOn(plan, 'experiences', /experiences_(title|description)_trgm/);
  });

  it('catalogue search: wineries name/commune ILIKE → trigram GIN', async () => {
    const plan = await explain(
      `SELECT id FROM wineries WHERE name ILIKE '%domaine%' OR commune ILIKE '%sion%'`
    );
    expectIndexOn(plan, 'wineries', /wineries_(name|commune)_trgm/);
  });

  it('my-bookings: visitorEmail ILIKE (equals insensitive) → trigram GIN', async () => {
    // Exact operator Prisma emits for mode:'insensitive' equals. The
    // predicate is visitorEmail ONLY: no other index can serve ILIKE,
    // so the plan pins the trigram index unambiguously.
    const plan = await explain(
      `SELECT id FROM bookings WHERE "visitorEmail" ILIKE 'client@test.encave.ch'`
    );
    expectIndexOn(plan, 'bookings', /bookings_visitor_email_trgm/);
  });

  // Composite indexes: on a near-empty table the planner arbitrarily
  // picks among overlapping candidates ([wineryId], [status]…), so
  // pinning the exact composite via EXPLAIN is flaky by nature. We pin
  // (1) the index EXISTS (migration applied), (2) the predicate is
  // index-servable (no Seq Scan under enable_seqscan=off).
  async function expectCompositeUsable(indexName: string, sql: string) {
    const rows = (await db.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'bookings' AND indexname = '${indexName}'`
    )) as Array<{ indexname: string }>;
    expect(rows.map((r) => r.indexname)).toEqual([indexName]);

    const plan = await explain(sql);
    const seqScans = collectNodes(plan).filter(
      (n) => n['Node Type'] === 'Seq Scan'
    );
    expect(seqScans, `Seq Scan for: ${sql}`).toEqual([]);
  }

  it('winery dashboard scans: [wineryId,status,date] exists and the predicate is index-served', async () => {
    await expectCompositeUsable(
      'bookings_wineryId_status_date_idx',
      `SELECT id FROM bookings WHERE "wineryId" = 'cltest000000000000000000' AND status = 'CONFIRMED' AND date >= now()`
    );
  });

  it('cron scans: [status,date] exists and the predicate is index-served', async () => {
    await expectCompositeUsable(
      'bookings_status_date_idx',
      `SELECT id FROM bookings WHERE status = 'PENDING_PAYMENT' AND date < now()`
    );
  });

  it('date-window prefilter: occurrence [date,status] exists and the range is index-served', async () => {
    const rows = (await db.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'experience_occurrences' AND indexname = 'experience_occurrences_date_status_idx'`
    )) as Array<{ indexname: string }>;
    expect(rows).toHaveLength(1);

    const plan = await explain(
      `SELECT id FROM experience_occurrences WHERE status = 'OPEN' AND date BETWEEN now() AND now() + interval '42 days'`
    );
    const seqScans = collectNodes(plan).filter(
      (n) => n['Node Type'] === 'Seq Scan'
    );
    expect(seqScans).toEqual([]);
  });
});
