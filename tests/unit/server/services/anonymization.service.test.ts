/**
 * anonymizeUser — table coverage (nLPD, pre-launch audit). The behaviour is
 * proven on a real database in tests/db/privacy-nlpd.test.ts; this suite
 * runs everywhere (no DB) and pins WHICH tables are covered and HOW:
 * personal fields blanked, financial rows updated — never deleted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx } = vi.hoisted(() => ({
  tx: {
    booking: { updateMany: vi.fn() },
    giftCard: { updateMany: vi.fn(), deleteMany: vi.fn() },
    giftCardTransaction: { deleteMany: vi.fn(), updateMany: vi.fn() },
    request: { updateMany: vi.fn(), deleteMany: vi.fn() },
    requestOffer: { updateMany: vi.fn(), deleteMany: vi.fn() },
    wineOrderRequest: { updateMany: vi.fn(), deleteMany: vi.fn() },
    clientEmailPreference: { deleteMany: vi.fn() },
    newsletterSubscription: { deleteMany: vi.fn() },
    experience: { updateMany: vi.fn() },
    winery: { update: vi.fn() },
    account: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
    adminAction: { create: vi.fn() },
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (_client: typeof tx) => unknown) => fn(tx)),
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendAccountDeletedEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { sendAccountDeletedEmail } =
  await import('@/server/services/email.service');
const { anonymizeUser } =
  await import('@/server/services/anonymization.service');

const EMAIL = 'jeanne@example.ch';
const byEmail = { equals: EMAIL, mode: 'insensitive' };

describe('anonymizeUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: EMAIL,
      preferredLocale: 'FR',
      anonymizedAt: null,
      winery: null,
    } as never);
  });

  function deletedEmail(): string {
    const call = tx.user.update.mock.calls[0]?.[0] as {
      data: { email: string };
    };
    return call.data.email;
  }

  it('blanks the buyer identity of gift cards — card and ledger untouched', async () => {
    await anonymizeUser('user-1', { notifyUser: false });

    expect(tx.giftCard.updateMany).toHaveBeenCalledWith({
      where: { purchaserEmail: byEmail },
      data: {
        purchaserEmail: deletedEmail(),
        purchaserName: null,
        message: null,
      },
    });
    expect(tx.giftCard.updateMany).toHaveBeenCalledWith({
      where: { recipientEmail: byEmail },
      data: { recipientEmail: null, recipientName: null, message: null },
    });
    // Financial records are never deleted, the ledger never written.
    expect(tx.giftCard.deleteMany).not.toHaveBeenCalled();
    expect(tx.giftCardTransaction.deleteMany).not.toHaveBeenCalled();
    expect(tx.giftCardTransaction.updateMany).not.toHaveBeenCalled();
    for (const call of tx.giftCard.updateMany.mock.calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data;
      expect(Object.keys(data)).not.toEqual(
        expect.arrayContaining(['code', 'balance', 'initialAmount', 'status'])
      );
    }
  });

  it('anonymizes sur-mesure requests and leaves the offers alone', async () => {
    await anonymizeUser('user-1', { notifyUser: false });

    expect(tx.request.updateMany).toHaveBeenCalledWith({
      where: { clientEmail: byEmail },
      data: {
        clientEmail: deletedEmail(),
        clientName: expect.any(String),
        clientPhone: null,
        description: '',
      },
    });
    expect(tx.request.deleteMany).not.toHaveBeenCalled();
    expect(tx.requestOffer.updateMany).not.toHaveBeenCalled();
    expect(tx.requestOffer.deleteMany).not.toHaveBeenCalled();
  });

  it('anonymizes wine order requests (lines kept)', async () => {
    await anonymizeUser('user-1', { notifyUser: false });

    expect(tx.wineOrderRequest.updateMany).toHaveBeenCalledWith({
      where: { clientEmail: byEmail },
      data: {
        clientEmail: deletedEmail(),
        clientName: expect.any(String),
        clientPhone: null,
      },
    });
    expect(tx.wineOrderRequest.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the pure contact-list rows', async () => {
    await anonymizeUser('user-1', { notifyUser: false });

    expect(tx.clientEmailPreference.deleteMany).toHaveBeenCalledWith({
      where: { email: byEmail },
    });
    expect(tx.newsletterSubscription.deleteMany).toHaveBeenCalledWith({
      where: { email: byEmail },
    });
  });

  it('still anonymizes bookings, drops accounts + sessions, and notifies with the ORIGINAL email', async () => {
    await anonymizeUser('user-1');

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { visitorEmail: byEmail } })
    );
    expect(tx.account.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith(EMAIL, 'FR');
  });

  it('does everything in ONE transaction and is a no-op when already anonymized', async () => {
    await anonymizeUser('user-1', { notifyUser: false });
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'deleted-x@encave.ch',
      anonymizedAt: new Date(),
      winery: null,
    } as never);

    expect(await anonymizeUser('user-1')).toEqual({ alreadyAnonymized: true });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
