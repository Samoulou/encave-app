import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WineryStatus } from '@prisma/client';

// The guard itself (role + suspension + TOTP + session age) has its own
// suite — here it is a switch: these tests pin what each action does once
// the guard has spoken, and that it is consulted before any write.
vi.mock('@/server/admin-guard', () => ({ requireAdmin: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn(), update: vi.fn() },
    experience: { updateMany: vi.fn() },
    user: { update: vi.fn() },
    session: { deleteMany: vi.fn() },
    adminAction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendManualRefundClientEmail: vi.fn(),
  sendManualRefundWinemakerEmail: vi.fn(),
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

vi.mock('@/server/services/anonymization.service', () => ({
  anonymizeUser: vi.fn(),
}));

vi.mock('@/server/stripe', () => ({
  getStripe: vi.fn(),
  isStripeConfigured: () => false,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { revalidateTag } = await import('next/cache');
const { requireAdmin } = await import('@/server/admin-guard');
const { db } = await import('@/server/db');
const { suspendWinery, reinstateWinery, suspendUser, reinstateUser } =
  await import('@/server/actions/admin');

const ADMIN_ID = 'cjld2cjxh0000qzrmn831i7ra';
const TARGET_ID = 'cjld2cjxh0000qzrmn831i7rb';
const REASON = 'Signalement confirmé par le support';
const valid = { targetId: TARGET_ID, reason: REASON };

const actions = [
  ['suspendWinery', suspendWinery],
  ['reinstateWinery', reinstateWinery],
  ['suspendUser', suspendUser],
  ['reinstateUser', reinstateUser],
] as const;

function noWrite() {
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(db.winery.update).not.toHaveBeenCalled();
  expect(db.user.update).not.toHaveBeenCalled();
  expect(db.session.deleteMany).not.toHaveBeenCalled();
  expect(db.adminAction.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({
    success: true,
    data: { adminId: ADMIN_ID },
  });
  vi.mocked(db.$transaction).mockResolvedValue([] as never);
  vi.mocked(db.winery.findUnique).mockResolvedValue({
    id: TARGET_ID,
    slug: 'cave-test',
    status: WineryStatus.VERIFIED,
  } as never);
});

describe.each(actions)('%s — access and validation', (_name, action) => {
  it.each([
    ['no payload', undefined],
    ['a non-cuid target', { targetId: '1 OR 1=1', reason: REASON }],
    ['a reason under 10 characters', { targetId: TARGET_ID, reason: 'spam' }],
    ['a blank reason', { targetId: TARGET_ID, reason: '            ' }],
    [
      'a reason over 500 characters',
      { targetId: TARGET_ID, reason: 'x'.repeat(501) },
    ],
  ])('rejects %s (VALIDATION_ERROR), no write', async (_label, input) => {
    const result = await action(input);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    noWrite();
  });

  it('anonymous caller → UNAUTHORIZED, no write', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
    });

    const result = await action(valid);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    noWrite();
  });

  it('non-admin (or suspended / TOTP-less admin) → FORBIDDEN, no write', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });

    const result = await action(valid);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    noWrite();
  });
});

describe('suspendWinery', () => {
  it('unknown winery → NOT_FOUND', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await suspendWinery(valid);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    noWrite();
  });

  it('suspends, archives the published experiences, journals, purges the public caches', async () => {
    const result = await suspendWinery(valid);

    expect(result).toEqual({
      success: true,
      data: { status: WineryStatus.SUSPENDED },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { status: WineryStatus.SUSPENDED },
    });
    // A suspended winery must stop selling at once.
    expect(db.experience.updateMany).toHaveBeenCalledWith({
      where: { wineryId: TARGET_ID, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: {
        adminId: ADMIN_ID,
        action: 'SUSPEND_WINERY',
        targetType: 'Winery',
        targetId: TARGET_ID,
        reason: REASON,
        metadata: { previousStatus: WineryStatus.VERIFIED },
      },
    });
    const tags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag);
    expect(tags).toEqual(expect.arrayContaining(['wineries', 'experiences']));
  });
});

describe('reinstateWinery', () => {
  it('unknown winery → NOT_FOUND', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await reinstateWinery(valid);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    noWrite();
  });

  it('restores VERIFIED and journals the previous status, without republishing experiences', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: TARGET_ID,
      slug: 'cave-test',
      status: WineryStatus.SUSPENDED,
    } as never);

    const result = await reinstateWinery(valid);

    expect(result).toEqual({
      success: true,
      data: { status: WineryStatus.VERIFIED },
    });
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { status: WineryStatus.VERIFIED },
    });
    expect(db.experience.updateMany).not.toHaveBeenCalled();
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REINSTATE_WINERY',
        targetId: TARGET_ID,
        metadata: { previousStatus: WineryStatus.SUSPENDED },
      }),
    });
  });
});

describe('suspendUser', () => {
  it('an admin cannot suspend their own account', async () => {
    const result = await suspendUser({ targetId: ADMIN_ID, reason: REASON });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    noWrite();
  });

  it('suspends, revokes every session of the target, journals', async () => {
    const result = await suspendUser(valid);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.suspendedAt).toBeInstanceOf(Date);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: {
        suspendedAt: result.data.suspendedAt,
        suspendedBy: ADMIN_ID,
        suspensionReason: REASON,
      },
    });
    // Without this the suspended account keeps calling server actions
    // until its session expires.
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: TARGET_ID },
    });
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: ADMIN_ID,
        action: 'SUSPEND_USER',
        targetType: 'User',
        targetId: TARGET_ID,
      }),
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('reinstateUser', () => {
  it('clears the three suspension fields and journals', async () => {
    const result = await reinstateUser(valid);

    expect(result).toEqual({ success: true, data: { reinstated: true } });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: TARGET_ID },
      data: { suspendedAt: null, suspendedBy: null, suspensionReason: null },
    });
    expect(db.session.deleteMany).not.toHaveBeenCalled();
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REINSTATE_USER',
        targetId: TARGET_ID,
        reason: REASON,
      }),
    });
  });
});
