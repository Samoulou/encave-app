/**
 * P-16 / L-181 — journey 4: cancellation + refund.
 * Tokenized ticket page → cancellation dialog (policy + refund preview) →
 * cancelBooking → CANCELLED_BY_CLIENT with the refund recorded (the
 * e2e_ payment intent resolves to a synthetic refund in processRefund).
 */
import crypto from 'crypto';

import { test, expect } from '../fixtures/auth.fixture';
import { testDb } from '../utils/db';

const BOOKING_ID = 'test-booking-cancel-target';
const TOKEN = 'token-cancel-target';

// Experience owned by the auth winery, seeded with a FIXED id (see
// setup-test-db.ts) — the gift fixture below attaches to it.
const AUTH_EXPERIENCE_ID = 'ce2eauthwinerytasting00001';

/**
 * Gift-funded cancellation fixture (ADR-0003): 9000 paid as 5000 gift +
 * 4000 card (`e2e_…` intent → synthetic refund), winery transfer settled
 * as the synthetic `tr_e2e_…`. Created PER TEST ATTEMPT (Codex review):
 * the cancellation mutates the booking, so a CI retry against a global
 * seed would find it already cancelled and fail deterministically. The
 * gift ledger is append-only by DB trigger — unique card code, booking
 * reference and token per attempt, never reuse or reset.
 */
async function seedGiftCancelFixture() {
  const db = testDb();
  const experience = await db.experience.findUnique({
    where: { id: AUTH_EXPERIENCE_ID },
    select: { id: true, wineryId: true },
  });
  if (!experience) {
    throw new Error('auth-winery experience missing — reseed the test DB');
  }

  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const token = `token-gift-cancel-${suffix}`;
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(0, 0, 0, 0);

  const card = await db.giftCard.create({
    data: {
      code: `E2EGC${suffix}`,
      initialAmount: 10000,
      balance: 5000,
      purchaserEmail: 'gift-cancel-purchaser@test.example.com',
      purchaserName: 'Gift Cancel Purchaser',
      expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
    },
  });
  const booking = await db.booking.create({
    data: {
      reference: `ENC-${suffix}`,
      visitorName: 'Gift Cancel Visitor',
      visitorEmail: 'gift-cancel@test.example.com',
      visitorPhone: '+41 79 000 00 03',
      experienceId: experience.id,
      wineryId: experience.wineryId,
      date,
      timeSlot: '11:00',
      guestCount: 2,
      totalPrice: 9000,
      platformFee: 1080,
      wineryPayout: 7920,
      status: 'CONFIRMED',
      stripePaymentIntentId: `e2e_pi_gift_cancel_${suffix}`,
      giftCardId: card.id,
      giftAppliedCents: 5000,
      accessTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    },
  });
  await db.booking.update({
    where: { id: booking.id },
    data: { giftTransferId: `tr_e2e_${booking.id}` },
  });
  await db.giftCardTransaction.createMany({
    data: [
      {
        giftCardId: card.id,
        type: 'PURCHASE',
        amount: 10000,
        note: 'e2e fixture',
      },
      {
        giftCardId: card.id,
        type: 'REDEMPTION',
        amount: -5000,
        bookingId: booking.id,
        note: 'e2e fixture redemption',
      },
    ],
  });
  return { bookingId: booking.id, giftCardId: card.id, token };
}

test.describe('Cancellation + refund', () => {
  test('guest cancels >24h before start and gets the full refund', async ({
    page,
  }) => {
    await page.goto(`/fr/booking/${BOOKING_ID}?token=${TOKEN}`);
    await expect(
      page.getByRole('heading', { name: 'Détails de la réservation' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Annuler la réservation' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Async refund preview — full refund expected (7 days out, STANDARD).
    await expect(
      dialog.getByText('Vous avez droit à un remboursement complet')
    ).toBeVisible({ timeout: 10000 });

    await dialog.locator('#confirm-cancel').click();
    await dialog
      .getByRole('button', { name: "Confirmer l'annulation" })
      .click();

    await expect(page.getByText('Réservation annulée')).toBeVisible({
      timeout: 10000,
    });

    const booking = await testDb().booking.findUnique({
      where: { id: BOOKING_ID },
    });
    expect(booking?.status).toBe('CANCELLED_BY_CLIENT');
    expect(booking?.refundIssued).toBe(true);
    // Full paid amount (9000, no service fee) recorded on the ledger.
    expect(booking?.refundAmount).toBe(9000);
    expect(booking?.cancelledAt).not.toBeNull();

    // The page reflects the cancelled state (no cancel button anymore).
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Annuler la réservation' })
    ).toBeHidden();
  });

  test('gift-funded booking cancellation runs the 3 movements (ADR-0003)', async ({
    page,
  }) => {
    const fixture = await seedGiftCancelFixture();

    await page.goto(`/fr/booking/${fixture.bookingId}?token=${fixture.token}`);
    await expect(
      page.getByRole('heading', { name: 'Détails de la réservation' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Annuler la réservation' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Vous avez droit à un remboursement complet')
    ).toBeVisible({ timeout: 10000 });

    await dialog.locator('#confirm-cancel').click();
    await dialog
      .getByRole('button', { name: "Confirmer l'annulation" })
      .click();

    await expect(page.getByText('Réservation annulée')).toBeVisible({
      timeout: 10000,
    });

    // Movement 1+2 — card refund (capped at the 4000 card charge) + gift
    // re-credit: refundAmount records the TOTAL returned to the client.
    const booking = await testDb().booking.findUnique({
      where: { id: fixture.bookingId },
    });
    expect(booking?.status).toBe('CANCELLED_BY_CLIENT');
    expect(booking?.refundIssued).toBe(true);
    expect(booking?.refundAmount).toBe(9000);
    expect(booking?.stripeRefundId).toMatch(/^re_e2e_/);
    expect(booking?.refundError).toBeNull();
    // Movement 3 — the winery transfer is clawed back (100% tier →
    // full wineryPayout), recorded on the durable idempotency column.
    expect(booking?.giftTransferReversalId).toBe(
      `trr_e2e_${fixture.bookingId}`
    );

    // The gift card got its 5000 back — balance restored, and the ledger
    // gained the REFUND movement tied to this booking.
    const card = await testDb().giftCard.findUnique({
      where: { id: fixture.giftCardId },
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    });
    expect(card?.balance).toBe(10000);
    const refundMovement = card?.transactions.find(
      (t) => t.type === 'REFUND' && t.bookingId === fixture.bookingId
    );
    expect(refundMovement?.amount).toBe(5000);
    expect(refundMovement?.note).toBe('cancellation_refund');
  });
});
