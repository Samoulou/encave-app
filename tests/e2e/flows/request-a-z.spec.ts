/**
 * P-16 / L-181 — journey 3: sur-mesure request A→Z.
 * Public form → winemaker composes the offer → client pays through the
 * tokenized offer page (fake session) → REAL webhook flips booking to
 * CONFIRMED and offer/request to PAID.
 */
import { test, expect } from '../fixtures/auth.fixture';
import { TEST_USERS } from '../fixtures/auth.fixture';
import { RequestPage } from '../pages/request.page';
import {
  loginAsFr,
  stubStripeCheckout,
  expectOnStripeStub,
} from '../utils/journeys';
import { confirmBookingViaWebhook } from '../utils/stripe-webhook';
import { testDb, findRequestByClientEmail } from '../utils/db';

function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

test.describe('Sur-mesure request A→Z', () => {
  test('request → offer → payment → tickets', async ({ page, browser }) => {
    const run = Date.now();
    const clientName = `Client SurMesure ${run}`;
    const clientEmail = `sur-mesure-${run}@e2e.test`;

    // 1. Public request form (flag REQUESTS is ON in the seed).
    const request = new RequestPage(page);
    await request.gotoPublicForm();
    await request.fillPublicForm({
      wineryName: 'Auth Test Winery',
      clientName,
      clientEmail,
      guestCount: 4,
      description:
        'Nous cherchons une dégustation privée avec accord mets-vins pour un anniversaire, budget flexible.',
    });
    await request.submitPublicForm();

    const created = await findRequestByClientEmail(clientEmail);
    expect(created).not.toBeNull();
    if (!created) return;
    expect(created.status).toBe('PENDING');

    // 2. Winemaker composes the offer.
    const wineryContext = await browser.newContext();
    const wineryPage = await wineryContext.newPage();
    await loginAsFr(wineryPage, TEST_USERS.wineryOwner);
    const wineryRequest = new RequestPage(wineryPage);
    await wineryRequest.gotoInbox();
    await wineryRequest.openRequest(clientName);
    await wineryRequest.composeOffer({
      message:
        'Avec plaisir ! Dégustation privée de 6 vins avec planchette valaisanne.',
      totalPriceChf: '900',
      date: isoDate(21),
      time: '18:00',
    });
    await wineryContext.close();

    const offered = await findRequestByClientEmail(clientEmail);
    const offer = offered?.offers[0];
    expect(offer).toBeTruthy();
    if (!offer) return;
    expect(offer.status).toBe('SENT');
    expect(offer.totalPrice).toBe(90000);

    // 3. Client pays through the tokenized offer page.
    await stubStripeCheckout(page);
    await request.gotoOffer(offer.paymentToken);
    await expect(page.getByText(/900/).first()).toBeVisible();
    await request.payOffer();
    await expectOnStripeStub(page);

    const offerWithBooking = await testDb().requestOffer.findUnique({
      where: { id: offer.id },
    });
    expect(offerWithBooking?.bookingId).not.toBeNull();
    const bookingId = offerWithBooking?.bookingId;
    if (!bookingId) return;

    // 4. REAL webhook: booking CONFIRMED + offer/request PAID (idempotent).
    const response = await confirmBookingViaWebhook(page.request, {
      bookingId,
      metadata: { kind: 'request_offer', requestOfferId: offer.id },
    });
    expect(response.ok()).toBeTruthy();

    const booking = await testDb().booking.findUnique({
      where: { id: bookingId },
    });
    expect(booking?.status).toBe('CONFIRMED');
    const paidOffer = await testDb().requestOffer.findUnique({
      where: { id: offer.id },
    });
    expect(paidOffer?.status).toBe('PAID');
    const paidRequest = await testDb().request.findUnique({
      where: { id: created.id },
    });
    expect(paidRequest?.status).toBe('PAID');

    // 5. The offer page now shows the paid state (no more pay button).
    await request.gotoOffer(offer.paymentToken);
    await expect(page.getByText('Offre déjà réglée')).toBeVisible();
  });
});
