import { describe, it, expect, vi, beforeEach } from 'vitest';

// unstable_cache pass-through: run the wrapped fn directly.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/server/stripe', () => ({
  getStripe: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
    },
  },
}));

import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import {
  listWineryPayouts,
  getNextPayout,
  getPayoutDetail,
  listRecentPaidPayouts,
} from '@/server/queries/payouts.queries';

const ACCT = 'acct_test123';

function stripePayout(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po_1',
    status: 'paid',
    amount: 8800,
    currency: 'chf',
    arrival_date: 1_770_000_000,
    created: 1_769_900_000,
    ...overrides,
  };
}

interface StripeMock {
  payouts: {
    list: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
  };
  balance: { retrieve: ReturnType<typeof vi.fn> };
  balanceTransactions: { list: ReturnType<typeof vi.fn> };
  transfers: { retrieve: ReturnType<typeof vi.fn> };
}

function buildStripeMock(): StripeMock {
  return {
    payouts: { list: vi.fn(), retrieve: vi.fn() },
    balance: { retrieve: vi.fn() },
    balanceTransactions: { list: vi.fn() },
    transfers: { retrieve: vi.fn() },
  };
}

let stripeMock: StripeMock;

beforeEach(() => {
  vi.clearAllMocks();
  stripeMock = buildStripeMock();
  vi.mocked(getStripe).mockReturnValue(stripeMock as never);
});

describe('listWineryPayouts', () => {
  it('maps Stripe payouts to serializable DTOs (epoch ms, uppercase currency)', async () => {
    stripeMock.payouts.list.mockResolvedValue({
      data: [
        stripePayout(),
        stripePayout({ id: 'po_2', status: 'in_transit' }),
      ],
    });

    const result = await listWineryPayouts(ACCT);

    expect(stripeMock.payouts.list).toHaveBeenCalledWith(
      { limit: 20 },
      { stripeAccount: ACCT }
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'po_1',
      status: 'paid',
      amountCents: 8800,
      currency: 'CHF',
      arrivalDateMs: 1_770_000_000_000,
      createdMs: 1_769_900_000_000,
    });
    expect(result[1]?.status).toBe('in_transit');
  });

  it('maps an unknown Stripe status to pending (never crashes the UI)', async () => {
    stripeMock.payouts.list.mockResolvedValue({
      data: [stripePayout({ status: 'some_future_status' })],
    });

    const result = await listWineryPayouts(ACCT);
    expect(result[0]?.status).toBe('pending');
  });

  it('propagates Stripe errors (page renders the retry banner)', async () => {
    stripeMock.payouts.list.mockRejectedValue(new Error('stripe down'));
    await expect(listWineryPayouts(ACCT)).rejects.toThrow('stripe down');
  });
});

describe('getNextPayout', () => {
  it('returns the earliest pending/in_transit payout', async () => {
    stripeMock.payouts.list.mockResolvedValue({
      data: [
        stripePayout({ id: 'po_a', status: 'paid', arrival_date: 100 }),
        stripePayout({
          id: 'po_b',
          status: 'in_transit',
          arrival_date: 300,
          amount: 5000,
        }),
        stripePayout({
          id: 'po_c',
          status: 'pending',
          arrival_date: 200,
          amount: 2000,
        }),
      ],
    });

    const result = await getNextPayout(ACCT);

    expect(result).toEqual({
      kind: 'payout',
      amountCents: 2000,
      arrivalDateMs: 200_000,
      status: 'pending',
    });
    expect(stripeMock.balance.retrieve).not.toHaveBeenCalled();
  });

  it('falls back to the pending CHF balance when no payout is scheduled', async () => {
    stripeMock.payouts.list.mockResolvedValue({
      data: [stripePayout({ status: 'paid' })],
    });
    stripeMock.balance.retrieve.mockResolvedValue({
      pending: [
        { currency: 'chf', amount: 4400 },
        { currency: 'eur', amount: 999 },
        { currency: 'chf', amount: 600 },
      ],
    });

    const result = await getNextPayout(ACCT);
    expect(result).toEqual({ kind: 'balance', amountCents: 5000 });
  });

  it('returns none when there is neither payout nor pending balance', async () => {
    stripeMock.payouts.list.mockResolvedValue({ data: [] });
    stripeMock.balance.retrieve.mockResolvedValue({ pending: [] });

    const result = await getNextPayout(ACCT);
    expect(result).toEqual({ kind: 'none' });
  });
});

describe('getPayoutDetail', () => {
  it('returns null for a payout unknown on this account (no cross-account leak)', async () => {
    stripeMock.payouts.retrieve.mockRejectedValue({
      type: 'StripeInvalidRequestError',
    });

    const result = await getPayoutDetail(ACCT, 'po_other_account');
    expect(result).toBeNull();
    expect(stripeMock.balanceTransactions.list).not.toHaveBeenCalled();
  });

  it('rethrows non-invalid-request Stripe errors', async () => {
    stripeMock.payouts.retrieve.mockRejectedValue(new Error('network'));
    await expect(getPayoutDetail(ACCT, 'po_1')).rejects.toThrow('network');
  });

  function mockTransactions(lines: unknown[]) {
    stripeMock.balanceTransactions.list.mockReturnValue({
      autoPagingToArray: vi.fn().mockResolvedValue(lines),
    });
  }

  it('correlates payment lines to bookings via transfer → payment_intent', async () => {
    stripeMock.payouts.retrieve.mockResolvedValue(stripePayout());
    mockTransactions([
      // The payout line itself — must be skipped.
      { type: 'payout', amount: -8800, created: 1, source: null },
      // Matched booking payment.
      {
        type: 'payment',
        amount: 8800,
        created: 2,
        source: { source_transfer: 'tr_1' },
      },
      // Unmatched adjustment.
      { type: 'adjustment', amount: -200, created: 3, source: null },
    ]);
    stripeMock.transfers.retrieve.mockResolvedValue({
      source_transaction: { payment_intent: 'pi_1' },
    });
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'bk_1',
        reference: 'ENC-ABCDEFGH',
        date: new Date('2026-06-15T00:00:00Z'),
        totalPrice: 10000,
        platformFee: 1200,
        wineryPayout: 8800,
        stripePaymentIntentId: 'pi_1',
        experience: { title: 'Dégustation cave' },
      },
    ] as never);

    const result = await getPayoutDetail(ACCT, 'po_1');

    expect(stripeMock.balanceTransactions.list).toHaveBeenCalledWith(
      { payout: 'po_1', limit: 100, expand: ['data.source'] },
      { stripeAccount: ACCT }
    );
    // Transfer resolved on the PLATFORM account (no stripeAccount header).
    expect(stripeMock.transfers.retrieve).toHaveBeenCalledWith('tr_1', {
      expand: ['source_transaction'],
    });
    expect(vi.mocked(db.booking.findMany).mock.calls[0]?.[0]?.where).toEqual({
      stripePaymentIntentId: { in: ['pi_1'] },
      winery: { stripeAccountId: ACCT },
    });
    expect(result?.bookings).toEqual([
      {
        bookingId: 'bk_1',
        reference: 'ENC-ABCDEFGH',
        experienceTitle: 'Dégustation cave',
        dateMs: new Date('2026-06-15T00:00:00Z').getTime(),
        grossCents: 10000,
        commissionCents: 1200,
        netCents: 8800,
      },
    ]);
    expect(result?.unmatchedLines).toEqual([
      { type: 'adjustment', amountCents: -200, createdMs: 3000 },
    ]);
    expect(result?.totalGrossCents).toBe(10000);
    expect(result?.totalCommissionCents).toBe(1200);
    expect(result?.payout.amountCents).toBe(8800);
  });

  it('keeps a payment line as unmatched when the transfer cannot be resolved', async () => {
    stripeMock.payouts.retrieve.mockResolvedValue(stripePayout());
    mockTransactions([
      {
        type: 'payment',
        amount: 4400,
        created: 5,
        source: { source_transfer: 'tr_dead' },
      },
    ]);
    stripeMock.transfers.retrieve.mockRejectedValue(new Error('gone'));

    const result = await getPayoutDetail(ACCT, 'po_1');

    expect(db.booking.findMany).not.toHaveBeenCalled();
    expect(result?.bookings).toEqual([]);
    expect(result?.unmatchedLines).toEqual([
      { type: 'payment', amountCents: 4400, createdMs: 5000 },
    ]);
  });
});

describe('listRecentPaidPayouts', () => {
  it('queries paid payouts arrived in the window', async () => {
    stripeMock.payouts.list.mockResolvedValue({ data: [stripePayout()] });

    const result = await listRecentPaidPayouts(ACCT, 7);

    const callArgs = stripeMock.payouts.list.mock.calls[0];
    expect(callArgs?.[0]).toMatchObject({ limit: 20, status: 'paid' });
    const gte = callArgs?.[0]?.arrival_date?.gte;
    expect(gte).toBeTypeOf('number');
    // ~7 days back from now (loose bound: within one minute of drift).
    const expected = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    expect(Math.abs(gte - expected)).toBeLessThan(60);
    expect(callArgs?.[1]).toEqual({ stripeAccount: ACCT });
    expect(result[0]?.id).toBe('po_1');
  });
});
