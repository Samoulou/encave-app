/**
 * Sur-mesure offer payment token — hash at rest (pre-launch audit).
 *  - composeRequestOfferAction derives the token from the offer id and
 *    stores its sha256 (plaintext still dual-written for the legacy
 *    readers);
 *  - createRequestOfferCheckout resolves the link hash-first and falls back
 *    to the legacy plaintext column for offers created before the column.
 * The rest of both actions is covered by request.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(async () => true),
}));
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => 'test-ip'),
  REQUEST_RATE_LIMIT: { maxRequests: 5, windowMs: 1000 },
  BOOKING_RATE_LIMIT: { maxRequests: 10, windowMs: 1000 },
}));
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));
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
  getOrCreateSurMesureExperience: vi.fn(),
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
    request: { findUnique: vi.fn(), updateMany: vi.fn() },
    requestOffer: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db };
});

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { sendRequestOfferReceivedEmail } =
  await import('@/server/services/email.service');
const { hashToken } = await import('@/lib/utils/token');
const { deriveOfferPaymentToken } =
  await import('@/lib/utils/offer-payment-token');
const { composeRequestOfferAction, createRequestOfferCheckout } =
  await import('@/server/actions/request');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (_tx: typeof db) => unknown)(db)
      : Promise.all(arg as Promise<unknown>[])) as never);
});

describe('composeRequestOfferAction — token storage', () => {
  const validOffer = {
    requestId: 'clrequest000000000000000',
    message: 'Dégustation privée pour votre groupe, accords mets-vins.',
    totalPriceCents: 120000,
    scheduledDate: '2027-08-20',
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
    vi.mocked(db.requestOffer.create).mockImplementation((async (args: {
      data: { id: string };
    }) => ({ id: args.data.id })) as never);
  });

  it('derives the token from the offer id and stores its sha256', async () => {
    const result = await composeRequestOfferAction(validOffer);
    expect(result.success).toBe(true);

    const data = (
      vi.mocked(db.requestOffer.create).mock.calls[0]?.[0] as {
        data: { id: string; paymentToken?: string; paymentTokenHash: string };
      }
    ).data;

    expect(data.id).toEqual(expect.any(String));
    // Hash at rest: the plaintext token is NEVER written, only its sha256 —
    // a DB reader cannot rebuild the payment link.
    expect(data.paymentToken).toBeUndefined();
    expect(data.paymentTokenHash).toBe(
      hashToken(deriveOfferPaymentToken(data.id))
    );
    if (result.success) expect(result.data.offerId).toBe(data.id);
  });

  it('emails the link built from that same token', async () => {
    await composeRequestOfferAction(validOffer);

    const data = (
      vi.mocked(db.requestOffer.create).mock.calls[0]?.[0] as {
        data: { id: string };
      }
    ).data;
    const email = vi.mocked(sendRequestOfferReceivedEmail).mock
      .calls[0]?.[1] as {
      payUrl: string;
    };
    expect(email.payUrl).toBe(
      `https://encave.ch/fr/sur-mesure/offre/${deriveOfferPaymentToken(data.id)}`
    );
  });
});

describe('createRequestOfferCheckout — token lookup', () => {
  const token = 'a'.repeat(48);
  // An expired offer stops the action right after the lookup (CONFLICT),
  // which is all this suite needs to tell "found" from "not found".
  const expiredOffer = {
    id: 'offer-1',
    status: 'SENT',
    totalPrice: 120000,
    expiresAt: new Date(Date.now() - 1000),
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
        commissionRate: null,
        cancellationPolicy: 'STANDARD',
      },
    },
  };

  it('looks the offer up by the sha256 of the token first', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValueOnce(
      expiredOffer as never
    );

    const result = await createRequestOfferCheckout({ token });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.requestOffer.findUnique).toHaveBeenCalledTimes(1);
    expect(db.requestOffer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paymentTokenHash: hashToken(token) } })
    );
  });

  it('falls back to the legacy plaintext column for offers without a hash', async () => {
    vi.mocked(db.requestOffer.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(expiredOffer as never);

    const result = await createRequestOfferCheckout({ token });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.requestOffer.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { paymentToken: token } })
    );
  });

  it('answers NOT_FOUND when neither lookup matches', async () => {
    vi.mocked(db.requestOffer.findUnique).mockResolvedValue(null);

    const result = await createRequestOfferCheckout({ token });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.requestOffer.findUnique).toHaveBeenCalledTimes(2);
  });
});
