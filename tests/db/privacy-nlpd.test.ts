/**
 * nLPD (pre-launch audit 2026-11-12) — data export + anonymization against
 * a REAL migrated database: the two must cover the SAME email-keyed tables
 * (bookings, gift cards bought / received, sur-mesure requests, wine order
 * requests, email preferences, newsletter), matched case-insensitively.
 *
 * Financial records are anonymized, never deleted: the gift-card code,
 * balance and append-only ledger, the offers and their prices, the ordered
 * wine lines all survive (the DB trigger on gift_card_transactions would
 * refuse a delete anyway — proven here).
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/encave_inv_sec \
 *     npx vitest run --no-file-parallelism tests/db/privacy-nlpd.test.ts
 * Skipped when the env var is absent.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('@/server/services/email.service', () => ({
  sendAccountDeletedEmail: vi.fn(async () => {}),
}));

type Anonymization = typeof import('@/server/services/anonymization.service');
type PrivacyExport = typeof import('@/server/services/privacy-export.service');

describe.skipIf(!url)('nLPD export + anonymization (real DB)', () => {
  let db: PrismaClient;
  let anonymizeUser: Anonymization['anonymizeUser'];
  let buildPrivacyExport: PrivacyExport['buildPrivacyExport'];

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const subjectEmail = `nlpd-subject-${stamp}@test.encave.ch`;
  // Guest-facing rows were typed with another casing than the account's.
  const typedEmail = `NLPD-Subject-${stamp}@Test.Encave.CH`;
  const otherEmail = `nlpd-other-${stamp}@test.encave.ch`;
  const ownerEmail = `nlpd-owner-${stamp}@test.encave.ch`;
  const code = (prefix: string) =>
    `${prefix}${stamp.replace(/[^a-z0-9]/gi, '').slice(-9)}`.toUpperCase();

  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ({ anonymizeUser } =
      await import('@/server/services/anonymization.service'));
    ({ buildPrivacyExport } =
      await import('@/server/services/privacy-export.service'));
    db = new PrismaClient({ datasourceUrl: url });

    const owner = await db.user.create({
      data: { email: ownerEmail, role: 'WINEMAKER', name: 'Owner' },
    });
    ids.ownerId = owner.id;
    const winery = await db.winery.create({
      data: {
        name: `NLPD Winery ${stamp}`,
        slug: `nlpd-winery-${stamp}`,
        description: 'nLPD test fixture',
        address: 'Route du Test 9',
        commune: 'Sion',
        phone: '+41270000009',
        email: ownerEmail,
        userId: owner.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'NLPD Tasting',
        slug: `nlpd-tasting-${stamp}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 60,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 6,
        coverPhoto: '/images/herobanner-image-v2.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;
    const wine = await db.wine.create({
      data: {
        wineryId: winery.id,
        name: 'Fendant NLPD',
        grapeVariety: 'Chasselas',
        price: 2400,
      },
    });

    const subject = await db.user.create({
      data: {
        email: subjectEmail,
        name: 'Jeanne Sujet',
        emailVerified: true,
        sessions: {
          create: {
            token: `nlpd-session-${stamp}`,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        },
      },
    });
    ids.subjectId = subject.id;

    const booking = await db.booking.create({
      data: {
        reference: `ENC-NL${stamp.slice(-6).toUpperCase()}`,
        experienceId: experience.id,
        wineryId: winery.id,
        date: new Date('2026-06-15'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        visitorEmail: typedEmail,
        visitorName: 'Jeanne Sujet',
        visitorPhone: '+41791234567',
        status: 'COMPLETED',
      },
    });
    ids.bookingId = booking.id;

    await db.wineOrderRequest.create({
      data: {
        bookingId: booking.id,
        wineryId: winery.id,
        clientName: 'Jeanne Sujet',
        clientEmail: typedEmail,
        clientPhone: '+41791234567',
        items: {
          create: {
            wineId: wine.id,
            wineName: wine.name,
            grapeVariety: wine.grapeVariety,
            priceAtRequest: wine.price,
            quantity: 3,
          },
        },
      },
    });

    const purchased = await db.giftCard.create({
      data: {
        code: code('NLP'),
        initialAmount: 10000,
        balance: 10000,
        purchaserEmail: subjectEmail,
        purchaserName: 'Jeanne Sujet',
        recipientEmail: otherEmail,
        recipientName: 'Paul Autre',
        message: 'Joyeux anniversaire Paul — Jeanne',
        expiresAt: new Date(Date.now() + 5 * 365 * 86_400_000),
        transactions: {
          create: { type: 'PURCHASE', amount: 10000, note: 'fixture' },
        },
      },
    });
    ids.purchasedCardId = purchased.id;
    const received = await db.giftCard.create({
      data: {
        code: code('NLR'),
        initialAmount: 5000,
        balance: 5000,
        purchaserEmail: otherEmail,
        purchaserName: 'Paul Autre',
        recipientEmail: typedEmail,
        recipientName: 'Jeanne Sujet',
        message: 'Pour toi Jeanne',
        expiresAt: new Date(Date.now() + 5 * 365 * 86_400_000),
      },
    });
    ids.receivedCardId = received.id;

    const request = await db.request.create({
      data: {
        reference: `REQ-${stamp.slice(-8).toUpperCase()}`,
        status: 'OFFERED',
        wineryId: winery.id,
        clientEmail: typedEmail,
        clientName: 'Jeanne Sujet',
        clientPhone: '+41791234567',
        guestCount: 8,
        description: 'Anniversaire de mariage, 8 personnes, budget libre.',
        offers: {
          create: {
            message: 'Dégustation privée 8 personnes.',
            totalPrice: 64000,
            expiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
        },
      },
    });
    ids.requestId = request.id;

    await db.clientEmailPreference.create({
      data: { email: subjectEmail, marketingOptOut: true },
    });
    await db.newsletterSubscription.create({
      data: { email: subjectEmail, source: 'coming-soon' },
    });
    // Somebody else's rows must never be touched or exported.
    await db.newsletterSubscription.create({
      data: { email: otherEmail, source: 'coming-soon' },
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.newsletterSubscription
      .deleteMany({ where: { email: { in: [subjectEmail, otherEmail] } } })
      .catch(() => {});
    await db.clientEmailPreference
      .deleteMany({ where: { email: subjectEmail } })
      .catch(() => {});
    await db.requestOffer
      .deleteMany({ where: { requestId: ids.requestId } })
      .catch(() => {});
    await db.request
      .deleteMany({ where: { id: ids.requestId } })
      .catch(() => {});
    // The received card has no ledger row → deletable. The purchased one
    // carries a PURCHASE movement: the append-only trigger keeps it forever
    // (by design) — it stays in the dedicated test database.
    await db.giftCard
      .deleteMany({ where: { id: ids.receivedCardId } })
      .catch(() => {});
    // WineOrderRequest cascades from the booking; bookings before winery.
    await db.booking
      .deleteMany({ where: { wineryId: ids.wineryId } })
      .catch(() => {});
    await db.user
      .deleteMany({ where: { id: { in: [ids.ownerId, ids.subjectId] } } })
      .catch(() => {});
    await db.$disconnect();
  });

  it('exports every table keyed by the email, case-insensitively', async () => {
    const payload = await buildPrivacyExport(ids.subjectId ?? '');
    const subject = payload?.subject;

    expect(subject?.user.email).toBe(subjectEmail);
    expect(subject?.bookings).toHaveLength(1);
    expect(subject?.giftCardsPurchased).toHaveLength(1);
    expect(subject?.giftCardsPurchased[0]?.transactions).toEqual([
      expect.objectContaining({ type: 'PURCHASE', amount: 10000 }),
    ]);
    expect(subject?.giftCardsReceived).toHaveLength(1);
    expect(subject?.requests).toHaveLength(1);
    expect(subject?.requests[0]?.offers).toHaveLength(1);
    expect(subject?.wineOrderRequests).toHaveLength(1);
    expect(subject?.wineOrderRequests[0]?.items).toHaveLength(1);
    expect(subject?.emailPreference).toMatchObject({ marketingOptOut: true });
    expect(subject?.newsletterSubscription).toMatchObject({
      email: subjectEmail,
    });
  });

  it('never exports secrets or the other party of a received gift', async () => {
    const payload = await buildPrivacyExport(ids.subjectId ?? '');
    const json = JSON.stringify(payload);

    // A recipient learns the buyer's display name, never their email.
    expect(payload?.subject.giftCardsReceived[0]).not.toHaveProperty(
      'purchaserEmail'
    );
    for (const secret of [
      'paymentToken',
      'unsubscribeToken',
      'accessTokenHash',
      'recapTokenHash',
      'stripe',
      'password',
    ]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it('returns null for an unknown user', async () => {
    expect(await buildPrivacyExport('does-not-exist')).toBeNull();
  });

  it('anonymizes every personal field and keeps the financial records', async () => {
    const result = await anonymizeUser(ids.subjectId ?? '', {
      notifyUser: false,
    });
    expect(result).toEqual({ alreadyAnonymized: false });

    const user = await db.user.findUniqueOrThrow({
      where: { id: ids.subjectId },
      include: { sessions: true },
    });
    expect(user.email).toMatch(/^deleted-.+@encave\.ch$/);
    expect(user.anonymizedAt).not.toBeNull();
    expect(user.sessions).toHaveLength(0);
    const deletedEmail = user.email;

    // --- booking
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: ids.bookingId },
    });
    expect(booking.visitorEmail).toBe(deletedEmail);
    expect(booking.visitorPhone).toBe('');
    expect(booking.totalPrice).toBe(5000);

    // --- gift card bought: identity + note gone, value + ledger intact
    const purchased = await db.giftCard.findUniqueOrThrow({
      where: { id: ids.purchasedCardId },
      include: { transactions: true },
    });
    expect(purchased.purchaserEmail).toBe(deletedEmail);
    expect(purchased.purchaserName).toBeNull();
    expect(purchased.message).toBeNull();
    expect(purchased.code).toBe(code('NLP'));
    expect(purchased.balance).toBe(10000);
    expect(purchased.initialAmount).toBe(10000);
    expect(purchased.status).toBe('ACTIVE');
    expect(purchased.transactions).toEqual([
      expect.objectContaining({ type: 'PURCHASE', amount: 10000 }),
    ]);
    // The recipient of that gift is another person — untouched.
    expect(purchased.recipientEmail).toBe(otherEmail);
    expect(purchased.recipientName).toBe('Paul Autre');

    // --- gift card received: still redeemable, no longer attached
    const received = await db.giftCard.findUniqueOrThrow({
      where: { id: ids.receivedCardId },
    });
    expect(received.recipientEmail).toBeNull();
    expect(received.recipientName).toBeNull();
    expect(received.message).toBeNull();
    expect(received.balance).toBe(5000);
    expect(received.code).toBe(code('NLR'));
    // The buyer is another person — untouched.
    expect(received.purchaserEmail).toBe(otherEmail);

    // --- sur-mesure request: identity + brief gone, the offer stays
    const request = await db.request.findUniqueOrThrow({
      where: { id: ids.requestId },
      include: { offers: true },
    });
    expect(request.clientEmail).toBe(deletedEmail);
    expect(request.clientName).not.toContain('Jeanne');
    expect(request.clientPhone).toBeNull();
    expect(request.description).toBe('');
    expect(request.status).toBe('OFFERED');
    expect(request.offers).toHaveLength(1);
    expect(request.offers[0]?.totalPrice).toBe(64000);
    expect(request.offers[0]?.message).toBe('Dégustation privée 8 personnes.');

    // --- wine order request: identity gone, ordered lines stay
    const order = await db.wineOrderRequest.findUniqueOrThrow({
      where: { bookingId: ids.bookingId },
      include: { items: true },
    });
    expect(order.clientEmail).toBe(deletedEmail);
    expect(order.clientName).not.toContain('Jeanne');
    expect(order.clientPhone).toBeNull();
    expect(order.items).toEqual([
      expect.objectContaining({ wineName: 'Fendant NLPD', quantity: 3 }),
    ]);

    // --- contact-list rows: gone; somebody else's row: still there
    expect(
      await db.clientEmailPreference.count({ where: { email: subjectEmail } })
    ).toBe(0);
    expect(
      await db.newsletterSubscription.count({ where: { email: subjectEmail } })
    ).toBe(0);
    expect(
      await db.newsletterSubscription.count({ where: { email: otherEmail } })
    ).toBe(1);
  });

  it('leaves no trace of the original email or name in any covered table', async () => {
    const needle = {
      contains: `nlpd-subject-${stamp}`,
      mode: 'insensitive',
    } as const;

    expect(await db.user.count({ where: { email: needle } })).toBe(0);
    expect(await db.booking.count({ where: { visitorEmail: needle } })).toBe(0);
    expect(
      await db.giftCard.count({
        where: { OR: [{ purchaserEmail: needle }, { recipientEmail: needle }] },
      })
    ).toBe(0);
    expect(await db.request.count({ where: { clientEmail: needle } })).toBe(0);
    expect(
      await db.wineOrderRequest.count({ where: { clientEmail: needle } })
    ).toBe(0);
    expect(
      await db.clientEmailPreference.count({ where: { email: needle } })
    ).toBe(0);
    expect(
      await db.newsletterSubscription.count({ where: { email: needle } })
    ).toBe(0);
  });

  it('the gift ledger is still append-only after anonymization', async () => {
    await expect(
      db.giftCardTransaction.deleteMany({
        where: { giftCardId: ids.purchasedCardId },
      })
    ).rejects.toThrow();
  });

  it('is idempotent', async () => {
    expect(
      await anonymizeUser(ids.subjectId ?? '', { notifyUser: false })
    ).toEqual({ alreadyAnonymized: true });
  });
});
