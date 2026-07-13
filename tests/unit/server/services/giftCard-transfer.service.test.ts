import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn(async () => ({}));
vi.mock('@/server/db', () => ({
  db: { booking: { findUnique, update } },
}));

const transfersCreate = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ transfers: { create: transfersCreate } }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { settleGiftTransfer } =
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
    expect(update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { giftTransferId: 'tr_1' },
    });
  });
});
