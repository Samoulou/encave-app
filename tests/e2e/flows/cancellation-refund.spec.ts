/**
 * P-16 / L-181 — journey 4: cancellation + refund.
 * Tokenized ticket page → cancellation dialog (policy + refund preview) →
 * cancelBooking → CANCELLED_BY_CLIENT with the refund recorded (the
 * e2e_ payment intent resolves to a synthetic refund in processRefund).
 */
import { test, expect } from '../fixtures/auth.fixture';
import { testDb } from '../utils/db';

const BOOKING_ID = 'test-booking-cancel-target';
const TOKEN = 'token-cancel-target';
// Per-run booking id (append-only ledger) — resolved by reference.
const GIFT_BOOKING_REF = 'ENC-E2E103';
const GIFT_TOKEN = 'token-gift-cancel-target';

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
    // Fixture: 9000 paid as 5000 gift + 4000 card, transfer settled.
    const seeded = await testDb().booking.findFirst({
      where: { reference: GIFT_BOOKING_REF },
      select: { id: true, giftCardId: true },
    });
    if (!seeded?.giftCardId) {
      throw new Error('gift-cancel fixture missing — reseed the test DB');
    }
    const giftBookingId = seeded.id;

    await page.goto(`/fr/booking/${giftBookingId}?token=${GIFT_TOKEN}`);
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
      where: { id: giftBookingId },
    });
    expect(booking?.status).toBe('CANCELLED_BY_CLIENT');
    expect(booking?.refundIssued).toBe(true);
    expect(booking?.refundAmount).toBe(9000);
    expect(booking?.stripeRefundId).toMatch(/^re_e2e_/);
    expect(booking?.refundError).toBeNull();
    // Movement 3 — the winery transfer is clawed back (100% tier →
    // full wineryPayout), recorded on the durable idempotency column.
    expect(booking?.giftTransferReversalId).toBe(`trr_e2e_${giftBookingId}`);

    // The gift card got its 5000 back — balance restored, and the ledger
    // gained the REFUND movement tied to this booking.
    const card = await testDb().giftCard.findUnique({
      where: { id: seeded.giftCardId },
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    });
    expect(card?.balance).toBe(10000);
    const refundMovement = card?.transactions.find(
      (t) => t.type === 'REFUND' && t.bookingId === giftBookingId
    );
    expect(refundMovement?.amount).toBe(5000);
    expect(refundMovement?.note).toBe('cancellation_refund');
  });
});
