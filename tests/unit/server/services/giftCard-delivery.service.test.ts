import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({
  db: { giftCard: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock('@/server/services/giftCard-pdf.service', () => ({
  generateGiftCardPDF: vi.fn(async () => Buffer.from('pdf')),
}));

const sendDelivery = vi.fn(async () => ({ ok: true }));
vi.mock('@/server/services/email.service', () => ({
  sendGiftCardDeliveryEmail: (...args: unknown[]) => sendDelivery(...args),
}));

vi.mock('@/server/services/giftCard.service', () => ({
  formatGiftCodeForDisplay: (c: string) => c,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ getBaseUrl: () => 'https://encave.ch' }));

const { db } = await import('@/server/db');
const { processGiftCardDeliveryJob } =
  await import('@/server/services/giftCard-delivery.service');

const activeCard = {
  id: 'gc-1',
  code: 'ABCDEFGHJKMN',
  status: 'ACTIVE',
  initialAmount: 10000,
  deliveredAt: null,
  recipientEmail: 'marie@example.com',
  recipientName: 'Marie',
  purchaserName: 'Jean',
  message: null,
  expiresAt: new Date('2031-12-24'),
  locale: 'FR',
  experience: null,
};

describe('processGiftCardDeliveryJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips an invalid payload', async () => {
    const r = await processGiftCardDeliveryJob(null);
    expect(r).toEqual({ ok: false, skipReason: 'invalid_payload' });
  });

  it('skips a missing card', async () => {
    vi.mocked(db.giftCard.findUnique).mockResolvedValue(null as never);
    const r = await processGiftCardDeliveryJob({ giftCardId: 'gc-x' });
    expect(r).toEqual({ ok: false, skipReason: 'gift_card_not_found' });
  });

  it('is idempotent once delivered', async () => {
    vi.mocked(db.giftCard.findUnique).mockResolvedValue({
      ...activeCard,
      deliveredAt: new Date(),
    } as never);
    const r = await processGiftCardDeliveryJob({ giftCardId: 'gc-1' });
    expect(r).toEqual({ ok: true, note: 'already_delivered' });
    expect(sendDelivery).not.toHaveBeenCalled();
  });

  it('never delivers a disabled card', async () => {
    vi.mocked(db.giftCard.findUnique).mockResolvedValue({
      ...activeCard,
      status: 'DISABLED',
    } as never);
    const r = await processGiftCardDeliveryJob({ giftCardId: 'gc-1' });
    expect(r).toEqual({ ok: false, skipReason: 'status_disabled' });
    expect(sendDelivery).not.toHaveBeenCalled();
  });

  it('sends and stamps deliveredAt on the happy path', async () => {
    vi.mocked(db.giftCard.findUnique).mockResolvedValue(activeCard as never);
    const r = await processGiftCardDeliveryJob({
      giftCardId: 'gc-1',
      variant: 'NOEL',
    });
    expect(r).toEqual({ ok: true });
    expect(sendDelivery).toHaveBeenCalledTimes(1);
    expect(db.giftCard.update).toHaveBeenCalledWith({
      where: { id: 'gc-1' },
      data: { deliveredAt: expect.any(Date) },
    });
  });

  it('throws when the send fails (job retries)', async () => {
    vi.mocked(db.giftCard.findUnique).mockResolvedValue(activeCard as never);
    sendDelivery.mockResolvedValueOnce({ ok: false });
    await expect(
      processGiftCardDeliveryJob({ giftCardId: 'gc-1' })
    ).rejects.toThrow();
  });
});
