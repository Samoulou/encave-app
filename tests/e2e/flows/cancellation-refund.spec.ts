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
});
