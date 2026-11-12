import { describe, it, expect } from 'vitest';
import {
  computeBookingEarnings,
  hasOnlineMoneyMovement,
  refundedFraction,
  type EarningsBookingFacts,
} from '@/lib/business-rules/earnings';

/** 200.00 of tickets, 12 % commission, 10.00 client fee — paid by card. */
function facts(
  overrides: Partial<EarningsBookingFacts> = {}
): EarningsBookingFacts {
  return {
    status: 'COMPLETED',
    totalPrice: 20000,
    serviceFeeCents: 1000,
    platformFee: 2400,
    wineryPayout: 17600,
    refundAmount: null,
    refundIssued: false,
    stripePaymentIntentId: 'pi_1',
    giftAppliedCents: 0,
    giftTransferId: null,
    ...overrides,
  };
}

describe('hasOnlineMoneyMovement', () => {
  it('a card charge always counts', () => {
    expect(hasOnlineMoneyMovement(facts())).toBe(true);
  });

  it('ON_SITE (no charge, no gift) never does', () => {
    expect(hasOnlineMoneyMovement(facts({ stripePaymentIntentId: null }))).toBe(
      false
    );
  });

  it('a gift redemption counts on a booking that takes place', () => {
    expect(
      hasOnlineMoneyMovement(
        facts({ stripePaymentIntentId: null, giftAppliedCents: 21000 })
      )
    ).toBe(true);
  });

  it('an ABANDONED gift checkout (cancelled, gift released, no transfer) moved nothing', () => {
    expect(
      hasOnlineMoneyMovement(
        facts({
          status: 'CANCELLED_BY_CLIENT',
          stripePaymentIntentId: null,
          giftAppliedCents: 21000,
          giftTransferId: null,
        })
      )
    ).toBe(false);
  });
});

describe('refundedFraction', () => {
  it('reads refundAmount alone — a partial admin refund counts with refundIssued false', () => {
    expect(
      refundedFraction(facts({ refundAmount: 10500, refundIssued: false }))
    ).toBe(0.5);
  });

  it('is 0 without a refund, 1 for a legacy "refunded" flag without amount, capped at 1', () => {
    expect(refundedFraction(facts())).toBe(0);
    expect(refundedFraction(facts({ refundIssued: true }))).toBe(1);
    expect(refundedFraction(facts({ refundAmount: 99999 }))).toBe(1);
    expect(
      refundedFraction(facts({ refundAmount: 0, refundIssued: true }))
    ).toBe(0);
  });
});

describe('computeBookingEarnings', () => {
  it('a paid booking earns its payout; NO_SHOW and CONFIRMED are identical to COMPLETED', () => {
    const completed = computeBookingEarnings(facts());
    expect(completed).toEqual({
      listed: true,
      countsAsBooking: true,
      online: true,
      grossCents: 20000,
      grossKeptCents: 20000,
      commissionCents: 2400,
      refundedCents: 0,
      netCents: 17600,
      refunded: false,
    });
    expect(computeBookingEarnings(facts({ status: 'NO_SHOW' }))).toEqual(
      completed
    );
    expect(computeBookingEarnings(facts({ status: 'CONFIRMED' }))).toEqual(
      completed
    );
  });

  it('ON_SITE is volume only: listed and counted, every money figure 0', () => {
    expect(
      computeBookingEarnings(facts({ stripePaymentIntentId: null }))
    ).toEqual({
      listed: true,
      countsAsBooking: true,
      online: false,
      grossCents: 0,
      grossKeptCents: 0,
      commissionCents: 0,
      refundedCents: 0,
      netCents: 0,
      refunded: false,
    });
  });

  it('a partial refund keeps the proportional payout AND commission; the identity is exact', () => {
    const half = computeBookingEarnings(facts({ refundAmount: 10500 }));
    expect(half).toMatchObject({
      grossCents: 20000,
      grossKeptCents: 10000,
      commissionCents: 1200,
      refundedCents: 10000,
      netCents: 8800,
      refunded: true,
    });
    expect(half.grossCents - half.commissionCents - half.refundedCents).toBe(
      half.netCents
    );
  });

  it('a client cancellation with money kept is listed (not a booking count), a fully refunded one is not', () => {
    expect(
      computeBookingEarnings(facts({ status: 'CANCELLED_BY_CLIENT' }))
    ).toMatchObject({ listed: true, countsAsBooking: false, netCents: 17600 });
    expect(
      computeBookingEarnings(
        facts({
          status: 'CANCELLED_BY_CLIENT',
          refundAmount: 21000,
          refundIssued: true,
        })
      ).listed
    ).toBe(false);
  });

  it('a winery cancellation, a pending booking and a cancelled ON_SITE one earn nothing and are not listed', () => {
    expect(
      computeBookingEarnings(facts({ status: 'CANCELLED_BY_WINERY' })).listed
    ).toBe(false);
    expect(
      computeBookingEarnings(facts({ status: 'PENDING_PAYMENT' })).listed
    ).toBe(false);
    expect(
      computeBookingEarnings(
        facts({ status: 'CANCELLED_BY_CLIENT', stripePaymentIntentId: null })
      ).listed
    ).toBe(false);
  });

  it('a gift-funded booking counts like a card one', () => {
    expect(
      computeBookingEarnings(
        facts({ stripePaymentIntentId: null, giftAppliedCents: 21000 })
      )
    ).toMatchObject({ online: true, netCents: 17600 });
  });
});
