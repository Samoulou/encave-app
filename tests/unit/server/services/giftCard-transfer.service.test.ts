import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn(async () => ({}));
const updateMany = vi.fn(async () => ({ count: 1 }));
const executeRaw = vi.fn(async () => 1);
vi.mock('@/server/db', () => ({
  db: {
    booking: { findUnique, update, updateMany },
    $executeRaw: (...args: unknown[]) => executeRaw(...args),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const transfersCreate = vi.fn();
const transfersCreateReversal = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    transfers: {
      create: transfersCreate,
      createReversal: transfersCreateReversal,
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { settleGiftTransfer, reverseGiftTransferForCancellation } =
  await import('@/server/services/giftCard-transfer.service');

const giftBooking = {
  id: 'bk-1',
  reference: 'ENC-ABCD1234',
  status: 'CONFIRMED',
  giftAppliedCents: 3000,
  giftTransferId: null,
  wineryPayout: 7200,
  winery: { stripeAccountId: 'acct_123' },
};

describe('settleGiftTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transfersCreate.mockResolvedValue({ id: 'tr_1' });
  });

  it('noops for a non-gift booking', async () => {
    findUnique.mockResolvedValue({ ...giftBooking, giftAppliedCents: 0 });
    expect(await settleGiftTransfer('bk-1')).toBe('noop');
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('noops when the transfer already landed (idempotent)', async () => {
    findUnique.mockResolvedValue({ ...giftBooking, giftTransferId: 'tr_old' });
    expect(await settleGiftTransfer('bk-1')).toBe('noop');
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('skips a booking that is not confirmed yet', async () => {
    findUnique.mockResolvedValue({
      ...giftBooking,
      status: 'PENDING_PAYMENT',
    });
    expect(await settleGiftTransfer('bk-1')).toBe('skipped');
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('skips when the winery has no Stripe account', async () => {
    findUnique.mockResolvedValue({
      ...giftBooking,
      winery: { stripeAccountId: null },
    });
    expect(await settleGiftTransfer('bk-1')).toBe('skipped');
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it('transfers the winery payout P and records the transfer id', async () => {
    findUnique.mockResolvedValue(giftBooking);
    const r = await settleGiftTransfer('bk-1');
    expect(r).toBe('transferred');
    const [params, opts] = transfersCreate.mock.calls[0] ?? [];
    expect(params.amount).toBe(7200);
    expect(params.currency).toBe('chf');
    expect(params.destination).toBe('acct_123');
    expect(params.transfer_group).toBe('booking_bk-1');
    expect(params.metadata.bookingId).toBe('bk-1');
    expect(opts.idempotencyKey).toBe('gift_payout_bk-1');
    // Conditional write: only a still-CONFIRMED, still-unsettled booking
    // can record the transfer (cancellation-race guard, Codex review).
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'bk-1', status: 'CONFIRMED', giftTransferId: null },
      data: { giftTransferId: 'tr_1' },
    });
    expect(transfersCreateReversal).not.toHaveBeenCalled();
  });

  it('fully reverses its own transfer when a cancellation claimed the booking mid-flight', async () => {
    findUnique
      .mockResolvedValueOnce(giftBooking) // initial eligibility read
      .mockResolvedValueOnce({
        status: 'CANCELLED_BY_CLIENT',
        giftTransferId: null,
      }); // post-write re-read
    updateMany.mockResolvedValueOnce({ count: 0 });

    const r = await settleGiftTransfer('bk-1');

    expect(r).toBe('skipped');
    const [transferId, params, opts] =
      transfersCreateReversal.mock.calls[0] ?? [];
    expect(transferId).toBe('tr_1');
    expect(params.metadata.reason).toBe('settle_cancellation_race');
    expect(opts.idempotencyKey).toBe('gift_payout_race_reversal_bk-1');
    // Durable marker via the atomic append — written BEFORE the reversal
    // call so a failed reversal still leaves tr_1 reconcilable.
    const appended = executeRaw.mock.calls.map((c) => String(c[1])).join(' ');
    expect(appended).toContain('GIFT_RACE_REVERSED');
    expect(appended).toContain('tr_1');
  });

  it('noops (no reversal) when a concurrent settle already recorded the SAME transfer', async () => {
    findUnique
      .mockResolvedValueOnce(giftBooking)
      .mockResolvedValueOnce({ status: 'CONFIRMED', giftTransferId: 'tr_1' });
    updateMany.mockResolvedValueOnce({ count: 0 });

    const r = await settleGiftTransfer('bk-1');

    expect(r).toBe('noop');
    expect(transfersCreateReversal).not.toHaveBeenCalled();
  });
});

describe('reverseGiftTransferForCancellation (P-16 / ADR-0003)', () => {
  const reversibleBooking = {
    giftTransferId: 'tr_1',
    giftTransferReversalId: null,
    wineryPayout: 7200,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    transfersCreateReversal.mockResolvedValue({ id: 'trr_1' });
  });

  it("returns 'no-transfer' when nothing was ever settled — the caller decides if the winery is owed", async () => {
    findUnique.mockResolvedValue({
      ...reversibleBooking,
      giftTransferId: null,
    });
    expect(await reverseGiftTransferForCancellation('bk-1', 7200)).toBe(
      'no-transfer'
    );
    expect(transfersCreateReversal).not.toHaveBeenCalled();
  });

  it('noops when already reversed (durable idempotency guard)', async () => {
    findUnique.mockResolvedValue({
      ...reversibleBooking,
      giftTransferReversalId: 'trr_old',
    });
    expect(await reverseGiftTransferForCancellation('bk-1', 7200)).toBe('noop');
    expect(transfersCreateReversal).not.toHaveBeenCalled();
  });

  it('noops on a non-positive reversal amount (0% refund tier)', async () => {
    expect(await reverseGiftTransferForCancellation('bk-1', 0)).toBe('noop');
    expect(findUnique).not.toHaveBeenCalled();
    expect(transfersCreateReversal).not.toHaveBeenCalled();
  });

  it('reverses with the idempotency key, capped at the transferred amount', async () => {
    findUnique.mockResolvedValue(reversibleBooking);
    const r = await reverseGiftTransferForCancellation('bk-1', 99999);
    expect(r).toBe('reversed');
    const [transferId, params, opts] =
      transfersCreateReversal.mock.calls[0] ?? [];
    expect(transferId).toBe('tr_1');
    expect(params.amount).toBe(7200);
    expect(params.metadata.bookingId).toBe('bk-1');
    expect(opts.idempotencyKey).toBe('gift_reversal_bk-1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { giftTransferReversalId: 'trr_1' },
    });
  });

  it('propagates a Stripe failure (caller logs + stores refundError)', async () => {
    findUnique.mockResolvedValue(reversibleBooking);
    transfersCreateReversal.mockRejectedValue(new Error('balance error'));
    await expect(
      reverseGiftTransferForCancellation('bk-1', 3600)
    ).rejects.toThrow('balance error');
    expect(update).not.toHaveBeenCalled();
  });
});
