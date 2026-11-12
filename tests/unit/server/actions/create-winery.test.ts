import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

const tx = {
  winery: { create: vi.fn() },
  user: { update: vi.fn() },
};

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@vercel/blob', () => ({ put: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/geocoding', () => ({ geocodeWineryAddress: vi.fn() }));
vi.mock('@/lib/posthog', () => ({ getPostHogServer: vi.fn(() => null) }));
vi.mock('@/server/services/welcome-email.service', () => ({
  sendWelcomeEmailToWinemaker: vi.fn(),
}));
vi.mock('@/server/services/email.service', () => ({
  sendAdminNewWineryToValidateEmail: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { geocodeWineryAddress } = await import('@/lib/geocoding');
const { sendWelcomeEmailToWinemaker } =
  await import('@/server/services/welcome-email.service');
const { sendAdminNewWineryToValidateEmail } =
  await import('@/server/services/email.service');
const { logError } = await import('@/lib/logger');
const { createWinery } = await import('@/server/actions/winery');

const session: Session = {
  user: {
    id: 'user-1',
    email: 'vigneron@test.ch',
    name: 'Vigneron',
    role: 'CLIENT',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
    emailVerified: true,
  },
};

const validInput = {
  name: 'Cave des Tests',
  description:
    'Un domaine familial au cœur du Valais, depuis quatre générations.',
  address: 'Route du Vignoble 12',
  commune: 'Sion',
  phone: '+41 27 123 45 67',
};

/** Route db.winery.findUnique by its predicate (userId / name / slug). */
function wineryLookups(found: {
  byUser?: unknown;
  byName?: unknown;
  bySlug?: (_slug: string) => unknown;
}) {
  vi.mocked(db.winery.findUnique).mockImplementation((async (args: {
    where: { userId?: string; name?: string; slug?: string };
  }) => {
    if (args.where.userId !== undefined) return found.byUser ?? null;
    if (args.where.name !== undefined) return found.byName ?? null;
    if (args.where.slug !== undefined) {
      return found.bySlug?.(args.where.slug) ?? null;
    }
    return null;
  }) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session);
  wineryLookups({});
  vi.mocked(db.user.findUnique).mockResolvedValue({
    email: 'vigneron@test.ch',
  } as never);
  vi.mocked(db.$transaction).mockImplementation((async (
    fn: (_tx: typeof tx) => unknown
  ) => fn(tx)) as never);
  tx.winery.create.mockImplementation(
    async (args: { data: { slug: string } }) => ({
      id: 'winery-1',
      slug: args.data.slug,
    })
  );
  vi.mocked(geocodeWineryAddress).mockResolvedValue(null as never);
  vi.mocked(sendWelcomeEmailToWinemaker).mockResolvedValue(undefined as never);
  vi.mocked(sendAdminNewWineryToValidateEmail).mockResolvedValue(true as never);
});

describe('createWinery', () => {
  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await createWinery(validInput);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['a one-letter name', { name: 'A' }],
    ['a too-short description', { description: 'Trop court.' }],
    ['a too-short address', { address: 'Rue' }],
    ['no commune', { commune: '' }],
    ['a non-Swiss phone number', { phone: '12345' }],
  ])('rejects %s (VALIDATION_ERROR) before any read', async (_, override) => {
    const result = await createWinery({ ...validInput, ...override });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.winery.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('one winery per user: a second registration is a CONFLICT', async () => {
    wineryLookups({ byUser: { id: 'existing' } });

    const result = await createWinery(validInput);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('a winery name already taken is a CONFLICT', async () => {
    wineryLookups({ byName: { id: 'other' } });

    const result = await createWinery(validInput);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('creates a PENDING winery owned by the caller and promotes the user, atomically', async () => {
    const result = await createWinery(validInput);

    expect(result).toEqual({
      success: true,
      data: { wineryId: 'winery-1', slug: 'cave-des-tests' },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.winery.create).toHaveBeenCalledWith({
      data: {
        name: 'Cave des Tests',
        slug: 'cave-des-tests',
        description: validInput.description,
        address: validInput.address,
        commune: 'Sion',
        phone: validInput.phone,
        // Contact email comes from the account, never from the payload.
        email: 'vigneron@test.ch',
        userId: 'user-1',
        // Never self-verified: an admin validates the domain.
        status: 'PENDING',
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: 'WINEMAKER' },
    });
  });

  it('ignores privileged fields smuggled into the payload', async () => {
    await createWinery({
      ...validInput,
      status: 'VERIFIED',
      commissionRate: 0,
      userId: 'someone-else',
    } as never);

    const data = tx.winery.create.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({ status: 'PENDING', userId: 'user-1' });
    expect(data).not.toHaveProperty('commissionRate');
  });

  it('suffixes the slug when it is already taken', async () => {
    wineryLookups({
      bySlug: (slug) => (slug === 'cave-des-tests' ? { id: 'taken' } : null),
    });

    const result = await createWinery(validInput);

    expect(result).toMatchObject({
      success: true,
      data: { slug: 'cave-des-tests-1' },
    });
  });

  it('notifies the winemaker and the admin inbox (awaited, not fire-and-forget)', async () => {
    await createWinery(validInput);

    expect(sendWelcomeEmailToWinemaker).toHaveBeenCalledWith('user-1');
    expect(sendAdminNewWineryToValidateEmail).toHaveBeenCalledWith({
      wineryName: 'Cave des Tests',
      commune: 'Sion',
      contactEmail: 'vigneron@test.ch',
      wineryId: 'winery-1',
    });
  });

  it('a failed email or geocoding never fails the committed creation', async () => {
    vi.mocked(geocodeWineryAddress).mockRejectedValue(new Error('nominatim'));
    vi.mocked(sendWelcomeEmailToWinemaker).mockRejectedValue(
      new Error('resend down')
    );
    vi.mocked(sendAdminNewWineryToValidateEmail).mockRejectedValue(
      new Error('resend down')
    );

    const result = await createWinery(validInput);

    expect(result.success).toBe(true);
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it('stores the coordinates when geocoding succeeds', async () => {
    vi.mocked(geocodeWineryAddress).mockResolvedValue({
      latitude: 46.233,
      longitude: 7.36,
    } as never);

    await createWinery(validInput);

    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: 'winery-1' },
      data: { latitude: 46.233, longitude: 7.36 },
    });
  });

  it('never throws: a DB failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(db.$transaction).mockRejectedValue(new Error('db down'));

    const result = await createWinery(validInput);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
