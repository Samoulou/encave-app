import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Locale, WineryStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        booking: { updateMany: vi.fn() },
        experience: { updateMany: vi.fn() },
        winery: { update: vi.fn() },
        account: { deleteMany: vi.fn() },
        session: { deleteMany: vi.fn() },
        user: { update: vi.fn() },
        adminAction: { create: vi.fn() },
      };
      await callback(tx);
      return tx;
    }),
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendAccountDeletedEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
}));

const { db } = await import('@/server/db');
const { sendAccountDeletedEmail } =
  await import('@/server/services/email.service');
const { anonymizeUser } =
  await import('@/server/services/anonymization.service');

function clientUser() {
  return {
    id: 'user-1',
    email: 'client@test.ch',
    name: 'Client',
    preferredLocale: Locale.FR,
    anonymizedAt: null,
    winery: null,
  };
}

describe('anonymizeUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('anonymizes user PII while keeping bookings operational', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(clientUser() as never);

    const result = await anonymizeUser('user-1');

    expect(result).toEqual({ alreadyAnonymized: false });
    expect(sendAccountDeletedEmail).toHaveBeenCalledWith(
      'client@test.ch',
      Locale.FR
    );
    const tx = await vi.mocked(db.$transaction).mock.results[0]?.value;
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { visitorEmail: 'client@test.ch' },
      data: expect.objectContaining({
        visitorEmail: expect.stringMatching(/^deleted-.+@encave\.ch$/),
        visitorName: 'Utilisateur supprime',
        visitorPhone: '',
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        email: expect.stringMatching(/^deleted-.+@encave\.ch$/),
        name: 'Utilisateur supprime',
        image: null,
        emailVerified: false,
        anonymizedAt: expect.any(Date),
      }),
    });
  });

  it('blocks winemaker anonymization when future confirmed bookings exist', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...clientUser(),
      winery: {
        id: 'winery-1',
        bookings: [{ id: 'booking-1' }, { id: 'booking-2' }],
      },
    } as never);

    await expect(anonymizeUser('user-1')).rejects.toThrow(
      'FUTURE_WINERY_BOOKINGS:2'
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('archives published experiences, suspends winery and logs admin action', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...clientUser(),
      winery: { id: 'winery-1', bookings: [] },
    } as never);

    await anonymizeUser('user-1', {
      actorId: 'admin-1',
      reason: 'Demande nLPD',
    });

    const tx = await vi.mocked(db.$transaction).mock.results[0]?.value;
    expect(tx.experience.updateMany).toHaveBeenCalledWith({
      where: { wineryId: 'winery-1', status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    expect(tx.winery.update).toHaveBeenCalledWith({
      where: { id: 'winery-1' },
      data: { status: WineryStatus.SUSPENDED },
    });
    expect(tx.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: 'admin-1',
        action: 'USER_ANONYMIZED',
        targetId: 'user-1',
      }),
    });
  });
});
