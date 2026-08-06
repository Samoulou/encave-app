/**
 * P-16 / L-181 — journey 2: gift card A→Z (purchase + redemption).
 * Purchase through the configurator UI (fake session), minting by the
 * REAL webhook (signed synthetic event), then PARTIAL redemption at the
 * booking checkout, and the FULL-coverage card=0 variant (server-side
 * confirmation without any Stripe session — WS-A DoD point b).
 */
import { test, expect } from '../fixtures/auth.fixture';
import { GiftPage } from '../pages/gift.page';
import {
  startBooking,
  fillCheckoutContact,
  submitCheckout,
  stubStripeCheckout,
  expectOnStripeStub,
} from '../utils/journeys';
import {
  confirmBookingViaWebhook,
  mintGiftCardViaWebhook,
} from '../utils/stripe-webhook';
import { testDb, findGiftCardByRecipient, giftLedgerSum } from '../utils/db';

test.describe('Gift card A→Z', () => {
  test('purchase via UI, partial redemption at checkout', async ({ page }) => {
    const run = Date.now();
    const purchaserEmail = `gift-buyer-${run}@e2e.test`;
    const recipientEmail = `gift-recipient-${run}@e2e.test`;
    const visitorEmail = `gift-visitor-${run}@e2e.test`;
    await stubStripeCheckout(page);

    // 1. Purchase through the configurator (default 100 CHF card).
    const gift = new GiftPage(page);
    await gift.gotoConfigurator();
    await gift.fillAmountGift({
      purchaserName: 'Gift Buyer',
      purchaserEmail,
      recipientEmail,
      message: 'Joyeux anniversaire !',
    });
    await gift.submitToPayment();
    await expectOnStripeStub(page);

    // 2. The REAL webhook mints the card (idempotent creation + ledger).
    const mintResponse = await mintGiftCardViaWebhook(page.request, {
      amountCents: 10000,
      purchaserEmail,
      purchaserName: 'Gift Buyer',
      recipientEmail,
    });
    expect(mintResponse.ok()).toBeTruthy();
    const card = await findGiftCardByRecipient(recipientEmail);
    expect(card).not.toBeNull();
    if (!card) return;
    expect(card.balance).toBe(10000);
    expect(await giftLedgerSum(card.id)).toBe(10000);

    // 3. Partial redemption: 3 guests × 45 CHF = 135 CHF due, 100 covered.
    // auth-winery-tasting: generated cuid id (the preview schema
    // validates experienceId as cuid — the fixed-id fixtures fail it).
    await startBooking(page, { slug: 'auth-winery-tasting', guests: 3 });
    await gift.applyGiftCode(card.code);
    await fillCheckoutContact(page, {
      firstName: 'Gift',
      lastName: 'Visitor',
      email: visitorEmail,
      phone: '+41 79 555 00 02',
    });
    await submitCheckout(page);
    await expectOnStripeStub(page);

    const pending = await testDb().booking.findFirst({
      where: { visitorEmail },
    });
    expect(pending).not.toBeNull();
    if (!pending) return;
    expect(pending.giftAppliedCents).toBe(10000);
    // The ledger already carries the reservation (redeem-at-creation).
    const cardAfterReserve = await testDb().giftCard.findUnique({
      where: { id: card.id },
    });
    expect(cardAfterReserve?.balance).toBe(0);

    // 4. Confirmation webhook (carries giftAppliedCents → settles transfer).
    const confirm = await confirmBookingViaWebhook(page.request, {
      bookingId: pending.id,
      metadata: { giftAppliedCents: '10000' },
    });
    expect(confirm.ok()).toBeTruthy();
    const confirmed = await testDb().booking.findUnique({
      where: { id: pending.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(confirmed?.giftTransferId).not.toBeNull();
  });

  test('full coverage card=0 confirms server-side without Stripe', async ({
    page,
  }) => {
    const run = Date.now();
    const recipientEmail = `gift-full-${run}@e2e.test`;
    const visitorEmail = `gift-full-visitor-${run}@e2e.test`;
    await stubStripeCheckout(page);

    // Card worth 100 CHF ≥ due (2 × 45 CHF = 90, no booking fee) → card = 0.
    const mint = await mintGiftCardViaWebhook(page.request, {
      amountCents: 10000,
      purchaserEmail: `gift-full-buyer-${run}@e2e.test`,
      purchaserName: 'Full Cover Buyer',
      recipientEmail,
    });
    expect(mint.ok()).toBeTruthy();
    const card = await findGiftCardByRecipient(recipientEmail);
    expect(card).not.toBeNull();
    if (!card) return;

    const gift = new GiftPage(page);
    await startBooking(page, { slug: 'auth-winery-tasting', guests: 2 });
    await gift.applyGiftCode(card.code);
    await fillCheckoutContact(page, {
      firstName: 'Full',
      lastName: 'Coverage',
      email: visitorEmail,
      phone: '+41 79 555 00 03',
    });
    await submitCheckout(page);

    // NO Stripe session: the action confirms server-side and sends the
    // client straight to the tokenized ticket page.
    await page.waitForURL(/\/fr\/booking\/[^/]+\?token=/, { timeout: 20000 });
    await expect(
      page.getByRole('heading', { name: 'Détails de la réservation' })
    ).toBeVisible();

    const booking = await testDb().booking.findFirst({
      where: { visitorEmail },
    });
    expect(booking?.status).toBe('CONFIRMED');
    expect(booking?.giftAppliedCents).toBe(9000);
    // Inline transfer settled (E2E synthetic id) — WS-A DoD (b)/(d) shape.
    expect(booking?.giftTransferId).not.toBeNull();

    const partial = await testDb().giftCard.findUnique({
      where: { id: card.id },
    });
    // 90 of 100 CHF redeemed — 10 CHF stays on the card (partial rule).
    expect(partial?.balance).toBe(1000);
    expect(await giftLedgerSum(card.id)).toBe(1000);
  });
});
