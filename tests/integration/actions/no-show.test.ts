import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { BookingStatus, NoShowChargeStatus } from '@prisma/client';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock getStripe (NOT the `stripe` package) so Stripe.errors.StripeCardError
// stays a real class for the instanceof branch.
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock('@/server/services/payment.service', () => ({
  getPlatformCommissionRate: () => 0.12,
}));

vi.mock('@/server/services/email.service', () => ({
  sendNoShowFeeChargedEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { getStripe } = await import('@/server/stripe');
const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { sendNoShowFeeChargedEmail } =
  await import('@/server/services/email.service');
const { chargeNoShowFee } = await import('@/server/actions/no-show');

const OWNER = { user: { id: 'user-1' } } as never;
const VALID_ID = 'clabcdefghijklmnopqrstuvwx';

function bookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    reference: 'ENC-TEST01',
    status: BookingStatus.NO_SHOW,
    guestCount: 2,
    visitorEmail: 'guest@example.com',
    visitorName: 'Jean Test',
    locale: 'FR',
    date: new Date('2026-07-01T00:00:00.000Z'),
    timeSlot: '10:00',
    noShowFeeCentsSnapshot: 1500,
    noShowPolicyAcceptedAt: new Date('2026-06-01T10:00:00.000Z'),
    noShowFeeChargeStatus: null,
    noShowFeeChargePaymentIntentId: null,
    stripeCustomerId: 'cus_1',
    noShowPaymentMethodId: 'pm_1',
    experience: {
      title: 'Dégustation',
      winery: {
        id: 'w1',
        userId: 'user-1',
        name: 'Cave du Test',
        stripeAccountId: 'acct_1',
        commissionRate: null,
        noShowFeeEnabled: true,
      },
    },
    ...overrides,
  };
}

const paymentIntentCreate = vi.fn();

describe('chargeNoShowFee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(getStripe).mockReturnValue({
      paymentIntents: { create: paymentIntentCreate },
    } as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid booking id (validation)', async () => {
    const result = await chargeNoShowFee({ bookingId: 'not-a-cuid' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses when the NO_SHOW_FEES flag is OFF', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('rejects a non-owner', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture({
        experience: {
          title: 'x',
          winery: {
            id: 'w1',
            userId: 'someone-else',
            name: 'Cave',
            stripeAccountId: 'acct_1',
            commissionRate: null,
            noShowFeeEnabled: true,
          },
        },
      }) as never
    );
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('refuses to charge a booking that is not NO_SHOW', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture({ status: BookingStatus.CONFIRMED }) as never
    );
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('NOT_NO_SHOW');
    }
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('refuses when the fee was already charged', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture({
        noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
        noShowFeeChargePaymentIntentId: 'pi_old',
      }) as never
    );
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toBe('ALREADY_CHARGED');
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('refuses when there is no card imprint', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture({ noShowPaymentMethodId: null }) as never
    );
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toBe('NO_IMPRINT');
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('loses the claim under concurrency (count 0) → CHARGE_IN_PROGRESS', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture() as never
    );
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);
    const result = await chargeNoShowFee({ bookingId: VALID_ID });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.message).toBe('CHARGE_IN_PROGRESS');
    expect(paymentIntentCreate).not.toHaveBeenCalled();
  });

  it('charges a destination charge (fee net of tier commission) and emails the client', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture() as never
    );
    paymentIntentCreate.mockResolvedValue({
      id: 'pi_new',
      status: 'succeeded',
    });

    const result = await chargeNoShowFee({ bookingId: VALID_ID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.chargedCents).toBe(3000);
    // amount = 1500 × 2 guests; commission = 12% of 3000 = 360.
    expect(paymentIntentCreate).toHaveBeenCalledTimes(1);
    const [params, opts] = paymentIntentCreate.mock.calls[0];
    expect(params.amount).toBe(3000);
    expect(params.currency).toBe('chf');
    expect(params.off_session).toBe(true);
    expect(params.confirm).toBe(true);
    expect(params.customer).toBe('cus_1');
    expect(params.payment_method).toBe('pm_1');
    expect(params.application_fee_amount).toBe(360);
    expect(params.transfer_data).toEqual({ destination: 'acct_1' });
    expect(opts.idempotencyKey).toContain(`no-show-fee:${VALID_ID}:`);
    // Persisted CHARGED with the PI id (write-once).
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: {
        noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
        noShowFeeChargedCents: 3000,
        noShowFeeChargePaymentIntentId: 'pi_new',
      },
    });
    expect(sendNoShowFeeChargedEmail).toHaveBeenCalledTimes(1);
  });

  it('omits the application fee for a Founder winery (0% commission)', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture({
        experience: {
          title: 'x',
          winery: {
            id: 'w1',
            userId: 'user-1',
            name: 'Cave',
            stripeAccountId: 'acct_1',
            commissionRate: 0,
            noShowFeeEnabled: true,
          },
        },
      }) as never
    );
    paymentIntentCreate.mockResolvedValue({ id: 'pi_f', status: 'succeeded' });

    const result = await chargeNoShowFee({ bookingId: VALID_ID });

    expect(result.success).toBe(true);
    const [params] = paymentIntentCreate.mock.calls[0];
    expect(params.application_fee_amount).toBeUndefined();
    expect(params.transfer_data).toEqual({ destination: 'acct_1' });
  });

  it('marks FAILED and returns PAYMENT_FAILED on a card decline', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      bookingFixture() as never
    );
    paymentIntentCreate.mockRejectedValue(
      new Stripe.errors.StripeCardError({
        type: 'card_error',
        code: 'card_declined',
        message: 'Your card was declined.',
      } as never)
    );

    const result = await chargeNoShowFee({ bookingId: VALID_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('PAYMENT_FAILED');
    // FAILED state persisted → retryable, PI id stays null.
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: VALID_ID },
      data: { noShowFeeChargeStatus: NoShowChargeStatus.FAILED },
    });
    expect(sendNoShowFeeChargedEmail).not.toHaveBeenCalled();
  });
});
