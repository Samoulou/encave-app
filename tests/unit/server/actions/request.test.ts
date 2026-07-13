import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => 'test-ip'),
  REQUEST_RATE_LIMIT: { maxRequests: 5, windowMs: 1000 },
  BOOKING_RATE_LIMIT: { maxRequests: 10, windowMs: 1000 },
}));

const sessionsCreate = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}));

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/server/services/payment.service', () => ({
  getPlatformCommissionRate: vi.fn(() => 0.12),
}));
vi.mock('@/server/services/sur-mesure-experience.service', () => ({
  getOrCreateSurMesureExperience: vi.fn(async () => ({
    id: 'exp-surmesure',
    title: 'Offre sur-mesure',
  })),
}));
vi.mock('@/server/services/request.service', () => ({
  generateRequestReference: vi.fn(() => 'REQ-TEST1234'),
  armRequestSlaEscalationJob: vi.fn(async () => undefined),
  armOfferJobs: vi.fn(async () => undefined),
  cancelSlaEscalationJob: vi.fn(async () => undefined),
  flipRequestOfferPaid: vi.fn(async () => undefined),
}));
vi.mock('@/server/services/email.service', () => ({
  sendRequestSubmittedEmail: vi.fn(async () => true),
  sendRequestNewCustomEmail: vi.fn(async () => true),
  sendRequestOfferReceivedEmail: vi.fn(async () => true),
}));

vi.mock('@/server/db', () => {
  const db = {
    winery: { findUnique: vi.fn() },
    request: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    requestOffer: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { db };
});

const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const {
  createRequestAction,
  composeRequestOfferAction,
  createRequestOfferCheckout,
} = await import('@/server/actions/request');

const validRequest = {
  wineryId: 'clwinery0000000000000000',
  clientName: 'Jean Dupont',
  clientEmail: 'jean@example.com',
  guestCount: 12,
  description: 'Sortie équipe, apéritif dînatoire pour 12 personnes.',
  locale: 'fr' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isFlagEnabled).mockResolvedValue(true);
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true } as never);
  vi.mocked(db.$transaction).mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (_tx: typeof db) => unknown)(db)
      : Promise.all(arg as Promise<unknown>[])
  );
});

describe('createRequestAction', () => {
  beforeEach(() => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: validRequest.wineryId,
      status: 'VERIFIED',
      name: 'Domaine Test',
      email: 'cave@example.com',
      user: { name: 'Paul', preferredLocale: 'FR' },
    } as never);
    vi.mocked(db.request.create).mockResolvedValue({
      id: 'req-1',
      reference: 'REQ-TEST1234',
      createdAt: new Date('2026-07-13T10:00:00Z'),
    } as never);
  });

  it('returns NOT_FOUND when the REQUESTS flag is OFF', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const r = await createRequestAction(validRequest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
    expect(db.request.create).not.toHaveBeenCalled();
  });

  it('rate-limits per IP', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ success: false } as never);
    const r = await createRequestAction(validRequest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('RATE_LIMITED');
  });

  it('rejects invalid input (missing description)', async () => {
    const r = await createRequestAction({ ...validRequest, description: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses a winery that is not VERIFIED', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: validRequest.wineryId,
      status: 'PENDING',
      name: 'X',
      email: 'x@x.com',
      user: { name: 'X', preferredLocale: 'FR' },
    } as never);
    const r = await createRequestAction(validRequest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
    expect(db.request.create).not.toHaveBeenCalled();
  });

  it('creates the request and returns its reference (happy path)', async () => {
    const r = await createRequestAction(validRequest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.requestReference).toBe('REQ-TEST1234');
    expect(db.request.create).toHaveBeenCalledTimes(1);
  });
});

describe('composeRequestOfferAction', () => {
  const validOffer = {
    requestId: 'clrequest000000000000000',
    message: 'Nous vous proposons une dégustation privée avec repas.',
    totalPriceCents: 120000,
    scheduledDate: '2026-08-20',
    scheduledStartTime: '18:00',
    validityDays: 7,
  };

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as never);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'domaine-test',
      name: 'Domaine Test',
    } as never);
    vi.mocked(db.request.findUnique).mockResolvedValue({
      id: validOffer.requestId,
      status: 'PENDING',
      wineryId: 'winery-1',
      clientEmail: 'jean@example.com',
      clientName: 'Jean',
      guestCount: 12,
      locale: 'FR',
    } as never);
    vi.mocked(db.request.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.requestOffer.create).mockResolvedValue({
      id: 'offer-1',
    } as never);
  });

  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const r = await composeRequestOfferAction(validOffer);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('returns FORBIDDEN when the flag is OFF', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const r = await composeRequestOfferAction(validOffer);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('FORBIDDEN');
  });

  it('refuses a request owned by another winery (tenant isolation)', async () => {
    vi.mocked(db.request.findUnique).mockResolvedValue({
      id: validOffer.requestId,
      status: 'PENDING',
      wineryId: 'other-winery',
      clientEmail: 'j@x.com',
      clientName: 'J',
      guestCount: 2,
      locale: 'FR',
    } as never);
    const r = await composeRequestOfferAction(validOffer);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
    expect(db.requestOffer.create).not.toHaveBeenCalled();
  });

  it('refuses a request that already has an offer (CONFLICT)', async () => {
    vi.mocked(db.request.findUnique).mockResolvedValue({
      id: validOffer.requestId,
      status: 'OFFERED',
      wineryId: 'winery-1',
      clientEmail: 'j@x.com',
      clientName: 'J',
      guestCount: 2,
      locale: 'FR',
    } as never);
    const r = await composeRequestOfferAction(validOffer);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONFLICT');
  });

  it('creates the offer and returns its id (happy path)', async () => {
    const r = await composeRequestOfferAction(validOffer);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.offerId).toBe('offer-1');
    expect(db.requestOffer.create).toHaveBeenCalledTimes(1);
  });
});

describe('createRequestOfferCheckout — money routing', () => {
  const token = 'a'.repeat(48);

  function offerRow(commissionRate: number | null) {
    return {
      id: 'offer-1',
      status: 'SENT',
      totalPrice: 120000,
      expiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      scheduledDate: new Date('2026-08-20'),
      scheduledStartTime: '18:00',
      bookingId: null,
      request: {
        clientEmail: 'jean@example.com',
        clientName: 'Jean',
        clientPhone: null,
        guestCount: 12,
        locale: 'FR',
        winery: {
          id: 'winery-1',
          name: 'Domaine Test',
          status: 'VERIFIED',
          stripeAccountId: 'acct_123',
          stripeOnboardingComplete: true,
          commissionRate,
          cancellationPolicy: 'STANDARD',
        },
      },
    };
  }

  beforeEach(() => {
    vi.mocked(db.booking.create).mockResolvedValue({
      id: 'bk-1',
      reference: 'ENC-ABCD1234',
    } as never);
    vi.mocked(db.requestOffer.updateMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      reference: 'ENC-ABCD1234',
    } as never);
    sessionsCreate.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/x',
    });
  });

  it('returns NOT_FOUND when the flag is OFF', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND for an unknown token', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(null as never);
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('rejects an expired offer (CONFLICT)', async () => {
    const row = offerRow(null);
    row.expiresAt = new Date(Date.now() - 1000);
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(row as never);
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONFLICT');
  });

  it('rejects a winery whose Stripe setup is incomplete', async () => {
    const row = offerRow(null);
    row.request.winery.stripeOnboardingComplete = false;
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(row as never);
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('STRIPE_NOT_READY');
  });

  it('standard winery: application_fee = 12% of the all-in price', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      offerRow(null) as never
    );
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(true);
    const params = sessionsCreate.mock.calls[0]?.[0];
    expect(params.payment_intent_data.application_fee_amount).toBe(14400);
    expect(params.payment_intent_data.transfer_data.destination).toBe(
      'acct_123'
    );
    expect(params.metadata.kind).toBe('request_offer');
    expect(params.metadata.requestOfferId).toBe('offer-1');
    // No service fee on a sur-mesure offer (decision Sam): one line item only.
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].price_data.unit_amount).toBe(120000);
    // Booking is created with the offer's all-in total and zero service fee.
    const bookingData = vi.mocked(db.booking.create).mock.calls[0]?.[0].data;
    expect(bookingData.totalPrice).toBe(120000);
    expect(bookingData.platformFee).toBe(14400);
    expect(bookingData.serviceFeeCents).toBe(0);
    expect(bookingData.wineryPayout).toBe(105600);
  });

  it('Founder winery (0%): no application_fee at all', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(
      offerRow(0) as never
    );
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(true);
    const params = sessionsCreate.mock.calls[0]?.[0];
    expect(params.payment_intent_data.application_fee_amount).toBeUndefined();
    const bookingData = vi.mocked(db.booking.create).mock.calls[0]?.[0].data;
    expect(bookingData.platformFee).toBe(0);
    expect(bookingData.wineryPayout).toBe(120000);
  });

  it('refuses to double-charge an already-paid offer', async () => {
    const row = offerRow(null);
    row.bookingId = 'bk-existing' as never;
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(row as never);
    vi.mocked(db.booking.findUnique).mockResolvedValueOnce({
      status: 'CONFIRMED',
    } as never);
    const r = await createRequestOfferCheckout({ token });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('CONFLICT');
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});
