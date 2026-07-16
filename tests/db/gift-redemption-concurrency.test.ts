/**
 * P-16 gift redemption concurrency (L-180) — the double-redemption half of
 * the G-R2 gate, verified against a REAL migrated database. The pessimistic
 * `SELECT … FOR UPDATE` in redeemGiftCardInTx was previously exercised only
 * through mocked `$queryRaw` — a mock cannot prove serialization.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 * Skipped when the env var is absent.
 *
 * The ledger is append-only (DB trigger: no UPDATE/DELETE) and gift cards
 * are Restrict-referenced by their transactions, so fixtures cannot be
 * cleaned up — same convention as invariants.test.ts (dedicated DB).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

// The service module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic import below.
if (url) {
  process.env.DATABASE_URL = url;
}

type RedemptionService =
  typeof import('@/server/services/giftCard-redemption.service');

describe.skipIf(!url)('gift redemption concurrency (P-16 / L-180)', () => {
  let db: PrismaClient;
  let redeemGiftCard: RedemptionService['redeemGiftCard'];
  let releaseGiftForBooking: RedemptionService['releaseGiftForBooking'];

  beforeAll(async () => {
    ({ redeemGiftCard, releaseGiftForBooking } =
      await import('@/server/services/giftCard-redemption.service'));
    db = new PrismaClient({ datasourceUrl: url });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function createCard(balance: number) {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const card = await db.giftCard.create({
      data: {
        code: `GRC${suffix}`,
        initialAmount: balance,
        balance,
        purchaserEmail: 'gift-concurrency@test.encave.ch',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    // The ledger invariant reads balance = initialAmount + SUM(movements
    // after purchase); seed the PURCHASE row like the real purchase webhook.
    await db.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: 'PURCHASE',
        amount: balance,
        note: 'test_fixture_purchase',
      },
    });
    return card;
  }

  async function ledgerSum(giftCardId: string): Promise<number> {
    const agg = await db.giftCardTransaction.aggregate({
      where: { giftCardId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  it('two concurrent full redemptions → exactly 1 succeeds, balance 0, never negative', async () => {
    const card = await createCard(5000);

    const [a, b] = await Promise.all([
      redeemGiftCard({
        code: card.code,
        dueCents: 5000,
        experienceId: 'exp-concurrency-a',
        bookingId: `grc-full-a-${card.id}`,
      }),
      redeemGiftCard({
        code: card.code,
        dueCents: 5000,
        experienceId: 'exp-concurrency-b',
        bookingId: `grc-full-b-${card.id}`,
      }),
    ]);

    const results = [a, b];
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    const success = successes[0];
    if (success && success.ok) {
      expect(success.result.appliedCents).toBe(5000);
      expect(success.result.remainingBalance).toBe(0);
    }
    const failure = failures[0];
    if (failure && !failure.ok) {
      expect(failure.error).toBe('DEPLETED');
    }

    const after = await db.giftCard.findUniqueOrThrow({
      where: { id: card.id },
    });
    expect(after.balance).toBe(0);
    // Ledger ↔ materialized balance coherence: PURCHASE + movements.
    expect(await ledgerSum(card.id)).toBe(after.balance);
    const redemptions = await db.giftCardTransaction.count({
      where: { giftCardId: card.id, type: 'REDEMPTION' },
    });
    expect(redemptions).toBe(1);
  });

  it('two concurrent partial redemptions whose sum exceeds the balance serialize — total applied ≤ balance', async () => {
    const card = await createCard(5000);

    const [a, b] = await Promise.all([
      redeemGiftCard({
        code: card.code,
        dueCents: 3000,
        experienceId: 'exp-concurrency-a',
        bookingId: `grc-part-a-${card.id}`,
      }),
      redeemGiftCard({
        code: card.code,
        dueCents: 3000,
        experienceId: 'exp-concurrency-b',
        bookingId: `grc-part-b-${card.id}`,
      }),
    ]);

    // FOR UPDATE serializes: the winner applies 3000, the loser re-reads
    // the decremented balance and applies only the remaining 2000.
    const applied = [a, b]
      .filter((r) => r.ok)
      .map((r) => (r.ok ? r.result.appliedCents : 0));
    expect(applied).toHaveLength(2);
    const total = applied.reduce((s, n) => s + n, 0);
    expect(total).toBe(5000);
    expect(applied).toEqual(expect.arrayContaining([3000, 2000]));

    const after = await db.giftCard.findUniqueOrThrow({
      where: { id: card.id },
    });
    expect(after.balance).toBe(0);
    expect(after.balance).toBeGreaterThanOrEqual(0);
    expect(await ledgerSum(card.id)).toBe(after.balance);
  });

  it('two concurrent releases of the same abandoned booking refund exactly once', async () => {
    const card = await createCard(4000);
    const bookingId = `grc-release-${card.id}`;

    const redeemed = await redeemGiftCard({
      code: card.code,
      dueCents: 4000,
      experienceId: 'exp-concurrency-a',
      bookingId,
    });
    expect(redeemed.ok).toBe(true);

    const [r1, r2] = await Promise.all([
      releaseGiftForBooking(bookingId),
      releaseGiftForBooking(bookingId),
    ]);

    expect([r1, r2].sort()).toEqual(['noop', 'refunded']);

    const after = await db.giftCard.findUniqueOrThrow({
      where: { id: card.id },
    });
    // Restored exactly once — a double REFUND would read 8000.
    expect(after.balance).toBe(4000);
    const refunds = await db.giftCardTransaction.count({
      where: { bookingId, type: 'REFUND' },
    });
    expect(refunds).toBe(1);
    expect(await ledgerSum(card.id)).toBe(after.balance);
  });
});
