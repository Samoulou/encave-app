import { beforeEach, describe, expect, it, vi } from 'vitest';

const bookingUpdate = vi.fn(async () => ({}));
const bookingUpdateMany = vi.fn(async () => ({ count: 1 }));
const bookingFindUnique = vi.fn();
const bookingFindMany = vi.fn();
const giftLedgerAggregate = vi.fn();
const executeRaw = vi.fn(async () => 1);
vi.mock('@/server/db', () => {
  const db = {
    booking: {
      update: bookingUpdate,
      updateMany: (...args: unknown[]) => bookingUpdateMany(...args),
      findUnique: (...args: unknown[]) => bookingFindUnique(...args),
      findMany: (...args: unknown[]) => bookingFindMany(...args),
    },
    giftCardTransaction: {
      aggregate: (...args: unknown[]) => giftLedgerAggregate(...args),
    },
    $executeRaw: (...args: unknown[]) => executeRaw(...args),
    // Interactive transactions run their callback on the same mock.
    $transaction: async (callback: (_tx: unknown) => unknown) => callback(db),
  };
  return { db };
});

const refundsList = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ refunds: { list: refundsList } }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

/** appendRefundError writes via one atomic $executeRaw — message is arg 1. */
function appendedMessages(): string[] {
  return executeRaw.mock.calls.map((call) => String(call[1]));
}

/** Full SQL text of every raw statement (template strings re-joined). */
function rawStatements(): string[] {
  return executeRaw.mock.calls.map((call) =>
    (call[0] as readonly string[]).join('?')
  );
}

function stripeInvalidRequest(message: string) {
  return Object.assign(new Error(message), {
    type: 'StripeInvalidRequestError',
  });
}

const processRefund = vi.fn();
vi.mock('@/server/services/payment.service', () => ({
  processRefund: (...args: unknown[]) => processRefund(...args),
}));

const releaseGiftForBooking = vi.fn();
vi.mock('@/server/services/giftCard-redemption.service', () => ({
  GIFT_CANCELLATION_REFUND_NOTE: 'cancellation_refund',
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

const {
  processCancellationRefund,
  wasNeverChargedOnline,
  recordCancellationRefund,
  syncBookingRefundFromStripe,
  claimBookingCancellation,
  clearCancellationRefundMarker,
  flagStuckCancellationRefunds,
} = await import('@/server/services/booking-refund.service');
const Sentry = await import('@sentry/nextjs');

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
  bookingUpdateMany.mockResolvedValue({ count: 1 });
  bookingFindUnique.mockResolvedValue(null);
  bookingFindMany.mockResolvedValue([]);
  giftLedgerAggregate.mockResolvedValue({ _sum: { amount: null } });
  executeRaw.mockResolvedValue(1);
  refundsList.mockResolvedValue({ data: [] });
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
      // No refund Stripe knew about that the ledger did not.
      ledgerDriftCents: 0,
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
      // No refund Stripe knew about that the ledger did not.
      ledgerDriftCents: 0,
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
      // No refund Stripe knew about that the ledger did not.
      ledgerDriftCents: 0,
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
    expect(appendedMessages().join(' ')).toContain('GIFT_REVERSAL_FAILED');
  });

  it('a gift-restore failure never throws and does not count as returned', async () => {
    releaseGiftForBooking.mockRejectedValue(new Error('db down'));
    const outcome = await processCancellationRefund(giftBookingInput);
    expect(outcome.giftRestoredCents).toBe(0);
    expect(outcome.totalReturnedCents).toBe(7000);
    expect(appendedMessages().join(' ')).toContain('GIFT_RESTORE_FAILED');
    // The reversal is still attempted — independent compensation.
    expect(reverseGiftTransferForCancellation).toHaveBeenCalled();
  });
});

describe('wasNeverChargedOnline — ON_SITE bookings have nothing to refund', () => {
  const base = {
    stripePaymentIntentId: null,
    giftAppliedCents: 0,
    stripeCheckoutSessionId: null,
    noShowSetupIntentId: null,
  };

  it('true for an on-site booking without imprint (no Checkout Session at all)', () => {
    expect(wasNeverChargedOnline(base)).toBe(true);
  });

  it('true for an on-site booking with a card imprint (setup-mode session)', () => {
    expect(
      wasNeverChargedOnline({
        ...base,
        stripeCheckoutSessionId: 'cs_test_setup',
        noShowSetupIntentId: 'seti_test_1',
      })
    ).toBe(true);
  });

  it('false as soon as a card charge or a gift redemption exists', () => {
    expect(
      wasNeverChargedOnline({ ...base, stripePaymentIntentId: 'pi_test_1' })
    ).toBe(false);
    expect(wasNeverChargedOnline({ ...base, giftAppliedCents: 5000 })).toBe(
      false
    );
  });

  it('false for a PAYMENT session that lost its payment intent — the anomaly must keep alerting', () => {
    expect(
      wasNeverChargedOnline({
        ...base,
        stripeCheckoutSessionId: 'cs_test_payment',
      })
    ).toBe(false);
  });
});

describe('processCancellationRefund — refunds Stripe already holds (Dashboard refund never synced)', () => {
  const classicInput = {
    bookingId: 'bk-1',
    stripePaymentIntentId: 'pi_1',
    giftAppliedCents: 0,
    wineryPayout: 8100,
    refundDueCents: 9500, // policy owes 100 %, ledger knows of no refund
    alreadyRefundedCents: 0,
    paidCents: 9500,
    reversalCents: 8100,
    actionName: 'cancelBooking',
  };

  it('refunds only what is still due when Stripe already returned part of it', async () => {
    // 20.00 was refunded from the Stripe Dashboard; asking for 95.00
    // exceeds the unrefunded 75.00 → Stripe rejects.
    processRefund
      .mockRejectedValueOnce(
        stripeInvalidRequest('Refund amount is greater than unrefunded amount')
      )
      .mockResolvedValueOnce({ refundId: 're_rest', amount: 7500 });
    refundsList.mockResolvedValue({
      data: [{ amount: 2000, status: 'succeeded' }],
    });

    const outcome = await processCancellationRefund(classicInput);

    expect(processRefund).toHaveBeenCalledTimes(2);
    expect(processRefund).toHaveBeenLastCalledWith(
      'pi_1',
      true,
      7500,
      'cancel-refund:bk-1:7500'
    );
    expect(outcome).toEqual({
      cardRefundCents: 7500,
      stripeRefundId: 're_rest',
      giftRestoredCents: 0,
      totalReturnedCents: 7500,
      ledgerDriftCents: 2000,
    });
    expect(appendedMessages().join(' ')).toContain('STRIPE_REFUND_DRIFT');
  });

  it('refunds nothing more when Stripe already returned everything — the cancellation still goes through', async () => {
    processRefund.mockRejectedValueOnce(
      Object.assign(stripeInvalidRequest('already refunded'), {
        code: 'charge_already_refunded',
      })
    );
    refundsList.mockResolvedValue({
      data: [{ amount: 9500, status: 'succeeded' }],
    });

    const outcome = await processCancellationRefund(classicInput);

    expect(processRefund).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      cardRefundCents: null,
      stripeRefundId: null,
      giftRestoredCents: 0,
      totalReturnedCents: 0,
      ledgerDriftCents: 9500,
    });
  });

  it('ignores failed/canceled Stripe refunds and rethrows a genuine rejection (no drift)', async () => {
    const rejection = stripeInvalidRequest('No such payment_intent');
    processRefund.mockRejectedValueOnce(rejection);
    refundsList.mockResolvedValue({
      data: [
        { amount: 9500, status: 'failed' },
        { amount: 9500, status: 'canceled' },
      ],
    });

    await expect(processCancellationRefund(classicInput)).rejects.toBe(
      rejection
    );
    expect(processRefund).toHaveBeenCalledTimes(1);
  });

  it('never consults Stripe on an ambiguous (non-deterministic) failure', async () => {
    const network = new Error('socket hang up');
    processRefund.mockRejectedValueOnce(network);

    await expect(processCancellationRefund(classicInput)).rejects.toBe(network);
    expect(refundsList).not.toHaveBeenCalled();
  });
});

describe('recordCancellationRefund — the shared ledger write', () => {
  const outcome = {
    cardRefundCents: 7000,
    stripeRefundId: 're_1',
    giftRestoredCents: 5000,
    totalReturnedCents: 12000,
    ledgerDriftCents: 0,
  };

  it('writes read + returned, conditional on the refundAmount that was read', async () => {
    await recordCancellationRefund({
      bookingId: 'bk-1',
      readRefundAmount: null,
      outcome,
      actionName: 'cancelBooking',
    });

    expect(bookingUpdateMany).toHaveBeenCalledTimes(1);
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: 'bk-1', refundAmount: null },
      data: { refundIssued: true, refundAmount: 12000, stripeRefundId: 're_1' },
    });
    expect(appendedMessages()).toEqual([]);
  });

  it('adds the Stripe-side drift to the ledger', async () => {
    await recordCancellationRefund({
      bookingId: 'bk-1',
      readRefundAmount: null,
      outcome: {
        cardRefundCents: 7500,
        stripeRefundId: 're_rest',
        giftRestoredCents: 0,
        totalReturnedCents: 7500,
        ledgerDriftCents: 2000,
      },
      actionName: 'cancelBooking',
    });

    expect(bookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refundAmount: 9500 }),
      })
    );
  });

  it('does not flag the charge.refunded webhook syncing our own card refund first', async () => {
    // The webhook raised refundAmount to the card part (7000) before us.
    bookingUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    bookingFindUnique.mockResolvedValue({ refundAmount: 7000 });

    await recordCancellationRefund({
      bookingId: 'bk-1',
      readRefundAmount: null,
      outcome,
      actionName: 'cancelBooking',
    });

    expect(bookingUpdateMany).toHaveBeenLastCalledWith({
      where: { id: 'bk-1', refundAmount: 7000 },
      data: { refundIssued: true, refundAmount: 12000, stripeRefundId: 're_1' },
    });
    expect(appendedMessages()).toEqual([]);
  });

  it('flags a REAL concurrent writer (LEDGER_CONFLICT) and keeps the DB value', async () => {
    // An admin refund of 20.00 was reserved meanwhile — not ours.
    bookingUpdateMany.mockResolvedValueOnce({ count: 0 });
    bookingFindUnique.mockResolvedValue({ refundAmount: 2000 });

    await recordCancellationRefund({
      bookingId: 'bk-1',
      readRefundAmount: null,
      outcome,
      actionName: 'cancelBooking',
    });

    expect(bookingUpdateMany).toHaveBeenCalledTimes(1);
    expect(appendedMessages().join(' ')).toContain('LEDGER_CONFLICT');
  });

  it('writes nothing when nothing was returned', async () => {
    await recordCancellationRefund({
      bookingId: 'bk-1',
      readRefundAmount: null,
      outcome: {
        cardRefundCents: null,
        stripeRefundId: null,
        giftRestoredCents: 0,
        totalReturnedCents: 0,
        ledgerDriftCents: 0,
      },
      actionName: 'cancelBooking',
    });
    expect(bookingUpdateMany).not.toHaveBeenCalled();
  });
});

describe('syncBookingRefundFromStripe — charge.refunded', () => {
  it('raises refundAmount to card refunded + gift restored, monotonically', async () => {
    giftLedgerAggregate.mockResolvedValue({ _sum: { amount: 5000 } });

    const result = await syncBookingRefundFromStripe({
      bookingId: 'bk-1',
      cardRefundedCents: 7000,
    });

    expect(result).toBe('synced');
    const sql = rawStatements()[0] ?? '';
    // Only ever raises — a replayed or late event can never lower it.
    expect(sql).toContain('COALESCE("refundAmount", 0) <');
    expect(executeRaw.mock.calls[0]).toContain(12000);
  });

  it('is a no-op when the ledger already knows (echo of our own refund)', async () => {
    executeRaw.mockResolvedValueOnce(0);
    const result = await syncBookingRefundFromStripe({
      bookingId: 'bk-1',
      cardRefundedCents: 7000,
    });
    expect(result).toBe('noop');
  });

  it('ignores an event with nothing refunded', async () => {
    const result = await syncBookingRefundFromStripe({
      bookingId: 'bk-1',
      cardRefundedCents: 0,
    });
    expect(result).toBe('noop');
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe('cancellation claim + crash-recovery marker', () => {
  it('claims and records the owed refund in the same transaction', async () => {
    const claimed = await claimBookingCancellation({
      bookingId: 'bk-1',
      from: 'CONFIRMED',
      to: 'CANCELLED_BY_CLIENT',
      refundDueCents: 9500,
    });

    expect(claimed).toBe(true);
    expect(bookingUpdateMany).toHaveBeenCalledWith({
      where: { id: 'bk-1', status: 'CONFIRMED' },
      data: { status: 'CANCELLED_BY_CLIENT', cancelledAt: expect.any(Date) },
    });
    expect(appendedMessages()).toEqual(['CANCEL_REFUND_PENDING(9500)']);
  });

  it('writes no marker when nothing is owed, and none when the claim is lost', async () => {
    await claimBookingCancellation({
      bookingId: 'bk-1',
      from: 'CONFIRMED',
      to: 'CANCELLED_BY_CLIENT',
      refundDueCents: 0,
    });
    bookingUpdateMany.mockResolvedValueOnce({ count: 0 });
    const lost = await claimBookingCancellation({
      bookingId: 'bk-1',
      from: 'CONFIRMED',
      to: 'CANCELLED_BY_CLIENT',
      refundDueCents: 9500,
    });

    expect(lost).toBe(false);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('clears the marker with a statement that preserves the other markers', async () => {
    await clearCancellationRefundMarker('bk-1', 9500);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const sql = rawStatements()[0] ?? '';
    expect(sql).toContain('regexp_replace');
    expect(sql).toContain('CANCEL_REFUND_(PENDING|STUCK)');
  });

  it('skips the clear when the claim owed nothing', async () => {
    await clearCancellationRefundMarker('bk-1', 0);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('the sweep alerts once on a stale marker and relabels it STUCK', async () => {
    bookingFindMany.mockResolvedValue([
      {
        id: 'bk-9',
        reference: 'ENC-STUCK001',
        refundError: 'CANCEL_REFUND_PENDING(9500)',
      },
    ]);

    const flagged = await flagStuckCancellationRefunds(
      new Date('2026-11-12T12:00:00.000Z')
    );

    expect(flagged).toBe(1);
    // Only markers older than the grace period are picked.
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          refundError: { contains: 'CANCEL_REFUND_PENDING(' },
          cancelledAt: { lt: new Date('2026-11-12T11:45:00.000Z') },
        },
      })
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tags: { area: 'gift-refund', incident: 'cancel-refund-stuck' },
        extra: expect.objectContaining({ bookingRef: 'ENC-STUCK001' }),
      })
    );
    expect(executeRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['CANCEL_REFUND_PENDING(', 'CANCEL_REFUND_STUCK('])
    );
  });
});
