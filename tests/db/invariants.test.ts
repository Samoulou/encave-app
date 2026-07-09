/**
 * V3 money invariants — verified against a REAL migrated database
 * (CHECK constraints + triggers live in migrations, not in Prisma).
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 * The target database MUST have been created via `prisma migrate deploy`
 * (a `db push` database has no triggers). Skipped when the env var is
 * absent (the GitHub CI has no Postgres service).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

describe.skipIf(!url)('database invariants (P-02 / gate G-R0)', () => {
  let db: PrismaClient;
  const ids: {
    userId?: string;
    wineryId?: string;
    experienceId?: string;
  } = {};

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `invariants-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Invariants Test Winery ${Date.now()}`,
        slug: `invariants-test-${Date.now()}`,
        description: 'Invariants test fixture',
        address: 'Route du Test 1',
        commune: 'Sion',
        phone: '+41270000000',
        email: 'invariants@test.encave.ch',
        userId: user.id,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Invariants Tasting',
        slug: `invariants-tasting-${Date.now()}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
      },
    });
    ids.experienceId = experience.id;
  });

  afterAll(async () => {
    // FK cascades clean wines/occurrences/participants with the winery.
    // Gift cards with ledger entries are intentionally NOT deletable
    // (onDelete: Restrict + append-only trigger) — they stay in the
    // disposable test database; that immutability is itself the invariant.
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  function makeGiftCard(overrides: Record<string, unknown> = {}) {
    return db.giftCard.create({
      data: {
        code: `INV-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        initialAmount: 5000,
        balance: 5000,
        purchaserEmail: 'invariants@test.encave.ch',
        expiresAt: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000),
        ...overrides,
      },
    });
  }

  it('rejects a gift card created with a negative balance', async () => {
    await expect(makeGiftCard({ balance: -1 })).rejects.toThrow();
  });

  it('rejects driving a gift card balance below zero', async () => {
    const card = await makeGiftCard();
    await expect(
      db.giftCard.update({
        where: { id: card.id },
        data: { balance: { decrement: 5001 } },
      })
    ).rejects.toThrow();
    const reread = await db.giftCard.findUniqueOrThrow({
      where: { id: card.id },
    });
    expect(reread.balance).toBe(5000);
  });

  it('rejects a gift card with a non-positive initial amount', async () => {
    await expect(
      makeGiftCard({ initialAmount: 0, balance: 0 })
    ).rejects.toThrow();
  });

  it('forbids UPDATE on the gift card ledger (append-only trigger)', async () => {
    const card = await makeGiftCard();
    const tx = await db.giftCardTransaction.create({
      data: { giftCardId: card.id, type: 'PURCHASE', amount: 5000 },
    });
    await expect(
      db.giftCardTransaction.update({
        where: { id: tx.id },
        data: { amount: 999999 },
      })
    ).rejects.toThrow(/append-only/);
  });

  it('forbids DELETE on the gift card ledger (append-only trigger)', async () => {
    const card = await makeGiftCard();
    const tx = await db.giftCardTransaction.create({
      data: { giftCardId: card.id, type: 'PURCHASE', amount: 5000 },
    });
    await expect(
      db.giftCardTransaction.delete({ where: { id: tx.id } })
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a duplicate occurrence for the same experience/date/time', async () => {
    const data = {
      experienceId: ids.experienceId as string,
      date: new Date('2026-11-21'),
      startTime: '16:00',
    };
    await db.experienceOccurrence.create({ data });
    await expect(db.experienceOccurrence.create({ data })).rejects.toThrow(); // P2002 unique (experienceId, date, startTime)
  });

  it('rejects an occurrence capacity override below 1', async () => {
    await expect(
      db.experienceOccurrence.create({
        data: {
          experienceId: ids.experienceId as string,
          date: new Date('2026-11-22'),
          startTime: '10:00',
          capacityOverride: 0,
        },
      })
    ).rejects.toThrow();
  });

  it('rejects a no-show fee outside the 0–50 CHF product bounds', async () => {
    await expect(
      db.winery.update({
        where: { id: ids.wineryId },
        data: { noShowFeeCents: 9999 },
      })
    ).rejects.toThrow();
  });

  it('rejects a per-winery commission rate outside [0, 1]', async () => {
    await expect(
      db.winery.update({
        where: { id: ids.wineryId },
        data: { commissionRate: 1.5 },
      })
    ).rejects.toThrow();
  });

  it('rejects a request offer with a non-positive total price', async () => {
    const request = await db.request.create({
      data: {
        reference: `REQ-INV${Date.now() % 1e8}`,
        clientEmail: 'invariants@test.encave.ch',
        clientName: 'Invariants',
        guestCount: 10,
        description: 'Invariants test request',
      },
    });
    await expect(
      db.requestOffer.create({
        data: {
          requestId: request.id,
          message: 'Offer',
          totalPrice: 0,
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
        },
      })
    ).rejects.toThrow();
  });
});
