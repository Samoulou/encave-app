import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const transaction = vi.fn();
vi.mock('@/server/db', () => ({
  db: { giftCard: { findUnique }, $transaction: transaction },
}));

const {
  redeemGiftCardInTx,
  previewGiftRedemption,
  releaseGiftForBooking,
  normalizeGiftCode,
} = await import('@/server/services/giftCard-redemption.service');

function makeTx(row: Record<string, unknown> | null) {
  return {
    $queryRaw: vi.fn(async () => (row ? [row] : [])),
    giftCard: { update: vi.fn(async () => ({})) },
    giftCardTransaction: { create: vi.fn(async () => ({})) },
  };
}

const EXPERIENCE_ID = 'exp-1';

describe('normalizeGiftCode', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeGiftCode('abcd-efgh jkmn')).toBe('ABCDEFGHJKMN');
  });
});

describe('redeemGiftCardInTx', () => {
  const base = {
    code: 'ABCDEFGHJKMN',
    dueCents: 8000,
    experienceId: EXPERIENCE_ID,
    bookingId: 'bk-1',
  };

  it('errors when the code is unknown', async () => {
    const tx = makeTx(null);
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('refuses a disabled card', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 10000,
      status: 'DISABLED',
      experienceId: null,
    });
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r).toEqual({ ok: false, error: 'DISABLED' });
    expect(tx.giftCardTransaction.create).not.toHaveBeenCalled();
  });

  it('refuses an EXPIRED-status card', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 10000,
      status: 'EXPIRED',
      experienceId: null,
    });
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r).toEqual({ ok: false, error: 'EXPIRED' });
  });

  it('refuses a nominatif card on the wrong experience', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 10000,
      status: 'ACTIVE',
      experienceId: 'other-exp',
    });
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r).toEqual({ ok: false, error: 'WRONG_EXPERIENCE' });
  });

  it('allows a nominatif card on its own experience', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 10000,
      status: 'ACTIVE',
      experienceId: EXPERIENCE_ID,
    });
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r.ok).toBe(true);
  });

  it('refuses a depleted card', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 0,
      status: 'ACTIVE',
      experienceId: null,
    });
    const r = await redeemGiftCardInTx(tx as never, base);
    expect(r).toEqual({ ok: false, error: 'DEPLETED' });
  });

  it('applies a partial redemption capped at the balance', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 5000,
      status: 'ACTIVE',
      experienceId: null,
    });
    const r = await redeemGiftCardInTx(tx as never, base); // due 8000
    expect(r).toEqual({
      ok: true,
      result: {
        giftCardId: 'gc-1',
        code: base.code,
        appliedCents: 5000,
        remainingBalance: 0,
      },
    });
    expect(tx.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { balance: 0 },
    });
    expect(tx.giftCardTransaction.create).toHaveBeenCalledWith({
      data: {
        giftCardId: 'gc-1',
        type: 'REDEMPTION',
        amount: -5000,
        bookingId: 'bk-1',
        note: 'checkout_redemption',
      },
    });
  });

  it('leaves a remaining balance when the card covers the whole due', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 10000,
      status: 'ACTIVE',
      experienceId: null,
    });
    const r = await redeemGiftCardInTx(tx as never, {
      ...base,
      dueCents: 6000,
    });
    expect(r).toEqual({
      ok: true,
      result: {
        giftCardId: 'gc-1',
        code: base.code,
        appliedCents: 6000,
        remainingBalance: 4000,
      },
    });
    expect(tx.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { balance: 4000 },
    });
  });

  it('locks the row FOR UPDATE', async () => {
    const tx = makeTx({
      id: 'gc-1',
      code: base.code,
      balance: 5000,
      status: 'ACTIVE',
      experienceId: null,
    });
    await redeemGiftCardInTx(tx as never, base);
    const sql = tx.$queryRaw.mock.calls[0]?.[0] as unknown as string[];
    expect(sql.join('')).toContain('FOR UPDATE');
  });
});

describe('previewGiftRedemption', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the applicable amount and remaining due', async () => {
    findUnique.mockResolvedValue({
      code: 'ABCDEFGHJKMN',
      balance: 5000,
      status: 'ACTIVE',
      experienceId: null,
    });
    const r = await previewGiftRedemption({
      code: 'abcd-efgh-jkmn',
      dueCents: 8000,
      experienceId: EXPERIENCE_ID,
    });
    expect(r).toEqual({
      ok: true,
      preview: {
        code: 'ABCDEFGHJKMN',
        balance: 5000,
        applicableCents: 5000,
        remainingDueCents: 3000,
      },
    });
  });

  it('errors on an unknown code', async () => {
    findUnique.mockResolvedValue(null);
    const r = await previewGiftRedemption({
      code: 'ZZZZ',
      dueCents: 8000,
      experienceId: EXPERIENCE_ID,
    });
    expect(r).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('releaseGiftForBooking', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeReleaseTx(opts: {
    redemption: { giftCardId: string } | null;
    movements: { type: 'REDEMPTION' | 'REFUND'; amount: number }[];
  }) {
    return {
      giftCardTransaction: {
        findFirst: vi.fn(async () => opts.redemption),
        findMany: vi.fn(async () => opts.movements),
        create: vi.fn(async () => ({})),
      },
      $queryRaw: vi.fn(async () => [{ id: 'gc-1' }]),
      giftCard: { update: vi.fn(async () => ({})) },
    };
  }

  it('noops when the booking has no redemption', async () => {
    const tx = makeReleaseTx({ redemption: null, movements: [] });
    transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const r = await releaseGiftForBooking('bk-1');
    expect(r).toBe('noop');
    expect(tx.giftCard.update).not.toHaveBeenCalled();
  });

  it('noops when the redemption is already fully refunded (idempotent)', async () => {
    const tx = makeReleaseTx({
      redemption: { giftCardId: 'gc-1' },
      movements: [
        { type: 'REDEMPTION', amount: -5000 },
        { type: 'REFUND', amount: 5000 },
      ],
    });
    transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const r = await releaseGiftForBooking('bk-1');
    expect(r).toBe('noop');
    expect(tx.giftCard.update).not.toHaveBeenCalled();
  });

  it('restores the balance and writes a positive REFUND', async () => {
    const tx = makeReleaseTx({
      redemption: { giftCardId: 'gc-1' },
      movements: [{ type: 'REDEMPTION', amount: -5000 }],
    });
    transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const r = await releaseGiftForBooking('bk-1');
    expect(r).toBe('refunded');
    expect(tx.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { balance: { increment: 5000 } },
    });
    expect(tx.giftCardTransaction.create).toHaveBeenCalledWith({
      data: {
        giftCardId: 'gc-1',
        type: 'REFUND',
        amount: 5000,
        bookingId: 'bk-1',
        note: 'checkout_abandon',
      },
    });
  });

  it('restores only the OUTSTANDING debt after a GIFT_CHANGED retry pair (review #120, P1)', async () => {
    // REDEMPTION#1 + full REFUND (GIFT_CHANGED release) + REDEMPTION#2:
    // the old existence guard noop'ed here and the client lost the
    // re-consumed balance for good.
    const tx = makeReleaseTx({
      redemption: { giftCardId: 'gc-1' },
      movements: [
        { type: 'REDEMPTION', amount: -3000 },
        { type: 'REFUND', amount: 3000 },
        { type: 'REDEMPTION', amount: -3000 },
      ],
    });
    transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const r = await releaseGiftForBooking('bk-1', {
      amountCents: 3000,
      note: 'cancellation_refund',
    });
    expect(r).toBe('refunded');
    expect(tx.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { balance: { increment: 3000 } },
    });
    expect(tx.giftCardTransaction.create).toHaveBeenCalledWith({
      data: {
        giftCardId: 'gc-1',
        type: 'REFUND',
        amount: 3000,
        bookingId: 'bk-1',
        note: 'cancellation_refund',
      },
    });
  });

  it('caps a cancellation restore at the outstanding debt, never above', async () => {
    const tx = makeReleaseTx({
      redemption: { giftCardId: 'gc-1' },
      movements: [
        { type: 'REDEMPTION', amount: -5000 },
        { type: 'REFUND', amount: 4000 },
      ],
    });
    transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    const r = await releaseGiftForBooking('bk-1', { amountCents: 5000 });
    expect(r).toBe('refunded');
    expect(tx.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { balance: { increment: 1000 } },
    });
  });
});
