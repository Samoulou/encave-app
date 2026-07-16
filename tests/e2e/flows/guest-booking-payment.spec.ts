/**
 * P-16 / L-181 — journey 1: guest booking A→Z through payment.
 * Extends the historical smoke (guest-booking.spec.ts stops before
 * payment): widget → checkout → fake Stripe session → SIGNED synthetic
 * `checkout.session.completed` → booking CONFIRMED with a ticket token.
 */
import { test, expect } from '../fixtures/auth.fixture';
import {
  startBooking,
  fillCheckoutContact,
  submitCheckout,
  stubStripeCheckout,
  expectOnStripeStub,
} from '../utils/journeys';
import { confirmBookingViaWebhook } from '../utils/stripe-webhook';
import { testDb } from '../utils/db';

test.describe('Guest booking A→Z (payment + confirmation)', () => {
  test('books, pays and gets a confirmed ticket', async ({ page }) => {
    const visitorEmail = `guest-payment-${Date.now()}@e2e.test`;
    await stubStripeCheckout(page);

    await startBooking(page, { slug: 'wine-tasting-test', guests: 2 });
    await fillCheckoutContact(page, {
      firstName: 'Guest',
      lastName: 'Payment',
      email: visitorEmail,
      phone: '+41 79 555 00 01',
    });
    await submitCheckout(page);
    await expectOnStripeStub(page);

    // Ground truth: hold became a pending booking with the fake intent.
    const pending = await testDb().booking.findFirst({
      where: { visitorEmail },
    });
    expect(pending).not.toBeNull();
    if (!pending) return;
    expect(pending.status).toBe('PENDING_PAYMENT');
    expect(pending.stripePaymentIntentId).toBe(`e2e_${pending.id}`);

    // The REAL webhook route confirms it (signature verified server-side).
    const response = await confirmBookingViaWebhook(page.request, {
      bookingId: pending.id,
      bookingReference: pending.reference,
    });
    expect(response.ok()).toBeTruthy();

    const confirmed = await testDb().booking.findUnique({
      where: { id: pending.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(confirmed?.accessTokenHash).not.toBeNull();
    expect(confirmed?.expiresAt).toBeNull();

    // Redelivery is idempotent: same event shape → still one CONFIRMED.
    const redelivery = await confirmBookingViaWebhook(page.request, {
      bookingId: pending.id,
    });
    expect(redelivery.ok()).toBeTruthy();
    const after = await testDb().booking.findUnique({
      where: { id: pending.id },
    });
    expect(after?.status).toBe('CONFIRMED');
  });
});
