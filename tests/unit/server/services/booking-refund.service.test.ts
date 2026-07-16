import { beforeEach, describe, expect, it, vi } from 'vitest';

const bookingUpdate = vi.fn(async () => ({}));
const bookingFindUnique = vi.fn(async () => ({ refundError: null }));
vi.mock('@/server/db', () => ({
  db: { booking: { update: bookingUpdate, findUnique: bookingFindUnique } },
}));

const processRefund = vi.fn();
vi.mock('@/server/services/payment.service', () => ({
  processRefund: (...args: unknown[]) => processRefund(...args),
}));

const releaseGiftForBooking = vi.fn();
vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: (...args: unknown[]) => releaseGiftForBooking(...args),
}));

const reverseGiftTransferForCancellation = vi.fn();
vi.mock('@/server/services/giftCard-transfer.service', () => ({
  reverseGiftTransferForCancellation: (...args: unknown[]) =>
    reverseGiftTransferForCancellation(...args),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { processCancellationRefund } =
  await import('@/server/services/booking-refund.service');

/**
 * ADR-0003 reference case: 120 CHF booking (incl. fee), 50 CHF gift,
 * 70 CHF card charge; wineryPayout 105.60 (12% commission on 120).
 */
const giftBookingInput = {
  bookingId: 'bk-1',
  stripePaymentIntentId: 'pi_1',
  giftAppliedCents: 5000,
  wineryPayout: 10560,
  refundDueCents: 12000,
  alreadyRefundedCents: 0,
  paidCents: 12000,
  reversalCents: 10560,
  actionName: 'cancelBooking',
};

beforeEach(() => {
  vi.clearAllMocks();
  processRefund.mockResolvedValue({ refundId: 're_1', amount: 7000 });
  releaseGiftForBooking.mockResolvedValue('refunded');
  reverseGiftTransferForCancellation.mockResolvedValue('reversed');
});

describe('processCancellationRefund — classic booking', () => {
  it('keeps the single destination-charge refund (reverse_transfer default)', async () => {
    processRefund.mockResolvedValue({ refundId: 're_1', amount: 12000 });
    const outcome = await processCancellationRefund({
      ...giftBookingInput,
      giftAppliedCents: 0,
    });
    expect(processRefund).toHaveBeenCalledWith(
      'pi_1',
      true,
      12000,
      'cancel-refund:bk-1:12000'
    );
    expect(releaseGiftForBooking).not.toHaveBeenCalled();
    expect(reverseGiftTransferForCancellation).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      cardRefundCents: 12000,
      stripeRefundId: 're_1',
      giftRestoredCents: 0,
      totalReturnedCents: 12000,
    });
  });

  it('returns nothing when no refund is due (0% tier)', async () => {
    const outcome = await processCancellationRefund({
      ...giftBookingInput,
      refundDueCents: 0,
      reversalCents: 0,
    });
    expect(processRefund).not.toHaveBeenCalled();
    expect(outcome.totalReturnedCents).toBe(0);
  });
});

describe('processCancellationRefund — gift-funded booking (ADR-0003)', () => {
  it('partial gift: card refund without reverse_transfer, remainder restored, full reversal', async () => {
    const outcome = await processCancellationRefund(giftBookingInput);

    // Card first, capped at the 70 CHF platform charge, no transfer reverse.
    expect(processRefund).toHaveBeenCalledWith(
      'pi_1',
      false,
      7000,
      'cancel-refund:bk-1:7000',
      { reverseTransfer: false }
    );
    // Remainder (50 CHF) back onto the gift card.
    expect(releaseGiftForBooking).toHaveBeenCalledWith('bk-1', {
      amountCents: 5000,
      note: 'cancellation_refund',
    });
    // 100% refund → full winery clawback.
    expect(reverseGiftTransferForCancellation).toHaveBeenCalledWith(
      'bk-1',
      10560
    );
    expect(outcome).toEqual({
      cardRefundCents: 7000,
      stripeRefundId: 're_1',
      giftRestoredCents: 5000,
      totalReturnedCents: 12000,
    });
  });

  it('card=0 (full gift coverage): no Stripe refund, full gift restore + reversal', async () => {
    const outcome = await processCancellationRefund({
      ...giftBookingInput,
      stripePaymentIntentId: null,
      giftAppliedCents: 12000,
    });
    expect(processRefund).not.toHaveBeenCalled();
    expect(releaseGiftForBooking).toHaveBeenCalledWith('bk-1', {
      amountCents: 12000,
      note: 'cancellation_refund',
    });
    expect(reverseGiftTransferForCancellation).toHaveBeenCalledWith(
      'bk-1',
      10560
    );
    expect(outcome).toEqual({
      cardRefundCents: null,
      stripeRefundId: null,
      giftRestoredCents: 12000,
      totalReturnedCents: 12000,
    });
  });

  it('STRICT 50%: card absorbs the refund first, proportional reversal', async () => {
    processRefund.mockResolvedValue({ refundId: 're_1', amount: 6000 });
    const outcome = await processCancellationRefund({
      ...giftBookingInput,
      refundDueCents: 6000,
      reversalCents: 5280,
    });
    // 60 CHF due < 70 CHF card headroom → all from the card, gift untouched.
    expect(processRefund).toHaveBeenCalledWith(
      'pi_1',
      false,
      6000,
      'cancel-refund:bk-1:6000',
      { reverseTransfer: false }
    );
    expect(releaseGiftForBooking).not.toHaveBeenCalled();
    expect(reverseGiftTransferForCancellation).toHaveBeenCalledWith(
      'bk-1',
      5280
    );
    expect(outcome.totalReturnedCents).toBe(6000);
  });

  it('a CARD refund failure propagates (action keeps its claim semantics)', async () => {
    processRefund.mockRejectedValue(new Error('stripe down'));
    await expect(processCancellationRefund(giftBookingInput)).rejects.toThrow(
      'stripe down'
    );
    // Compensations never ran — the cancellation is being rolled back.
    expect(releaseGiftForBooking).not.toHaveBeenCalled();
    expect(reverseGiftTransferForCancellation).not.toHaveBeenCalled();
  });

  it('a reversal failure never throws: logged + persisted on refundError', async () => {
    reverseGiftTransferForCancellation.mockRejectedValue(
      new Error('reversal failed')
    );
    const outcome = await processCancellationRefund(giftBookingInput);
    expect(outcome.totalReturnedCents).toBe(12000);
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: {
        refundError: expect.stringContaining('GIFT_REVERSAL_FAILED'),
      },
    });
  });

  it('a gift-restore failure never throws and does not count as returned', async () => {
    releaseGiftForBooking.mockRejectedValue(new Error('db down'));
    const outcome = await processCancellationRefund(giftBookingInput);
    expect(outcome.giftRestoredCents).toBe(0);
    expect(outcome.totalReturnedCents).toBe(7000);
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: {
        refundError: expect.stringContaining('GIFT_RESTORE_FAILED'),
      },
    });
    // The reversal is still attempted — independent compensation.
    expect(reverseGiftTransferForCancellation).toHaveBeenCalled();
  });
});
