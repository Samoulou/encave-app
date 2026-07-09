import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OccurrenceStatus, UserRole } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    experienceOccurrence: {
      findFirst: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
    },
    experience: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/services/occurrence.service', () => ({
  generateOccurrences: vi.fn().mockResolvedValue({ created: 12 }),
  createPunctualOccurrences: vi.fn().mockResolvedValue({ created: 2 }),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { createPunctualOccurrences } =
  await import('@/server/services/occurrence.service');
const {
  closeOccurrence,
  reopenOccurrence,
  setOccurrenceCapacity,
  addPunctualOccurrences,
} = await import('@/server/actions/occurrence');

const ownerSession = {
  user: { id: 'user-1', role: UserRole.WINEMAKER },
} as never;

const ownedOccurrence = {
  id: 'ckvocc000000000000000000w',
  status: OccurrenceStatus.OPEN,
  experienceId: 'ckvexp000000000000000000w',
  experience: {
    slug: 'degustation',
    maxCapacity: 8,
    winery: { slug: 'cave-test' },
  },
};

describe('occurrence owner actions (P-05 / L-132)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(ownerSession);
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      ownedOccurrence as never
    );
    vi.mocked(db.experienceOccurrence.update).mockResolvedValue({
      status: OccurrenceStatus.CLOSED,
      capacityOverride: 4,
    } as never);
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const result = await closeOccurrence({
      occurrenceId: ownedOccurrence.id,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('UNAUTHORIZED');
    expect(db.experienceOccurrence.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid occurrence id', async () => {
    const result = await closeOccurrence({ occurrenceId: 'not-a-cuid' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('scopes ownership — a foreign occurrence is NOT_FOUND', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(null);
    const result = await closeOccurrence({
      occurrenceId: ownedOccurrence.id,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
    // Ownership expressed IN the query (tenant filter), not after it.
    expect(db.experienceOccurrence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          experience: { winery: { userId: 'user-1' } },
        }),
      })
    );
  });

  it('closes an occurrence and reports the new status', async () => {
    const result = await closeOccurrence({
      occurrenceId: ownedOccurrence.id,
    });
    expect(result.success).toBe(true);
    expect(db.experienceOccurrence.update).toHaveBeenCalledWith({
      where: { id: ownedOccurrence.id },
      data: { status: OccurrenceStatus.CLOSED },
      select: { status: true },
    });
  });

  it('refuses to reopen a CANCELLED occurrence (CONFLICT)', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue({
      ...ownedOccurrence,
      status: OccurrenceStatus.CANCELLED,
    } as never);
    const result = await reopenOccurrence({
      occurrenceId: ownedOccurrence.id,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONFLICT');
    expect(db.experienceOccurrence.update).not.toHaveBeenCalled();
  });

  it('sets and clears the capacity override within product bounds', async () => {
    const ok = await setOccurrenceCapacity({
      occurrenceId: ownedOccurrence.id,
      capacityOverride: 4,
    });
    expect(ok.success).toBe(true);

    const outOfBounds = await setOccurrenceCapacity({
      occurrenceId: ownedOccurrence.id,
      capacityOverride: 0,
    });
    expect(outOfBounds.success).toBe(false);
    if (!outOfBounds.success) {
      expect(outOfBounds.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('adds punctual occurrences for an owned experience', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'ckvexp000000000000000000w',
      slug: 'degustation',
      winery: { slug: 'cave-test' },
    } as never);

    const result = await addPunctualOccurrences({
      experienceId: 'ckvexp000000000000000000w',
      picks: [
        { date: '2026-08-01', startTime: '10:00' },
        { date: '2026-08-02', startTime: '16:00' },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.created).toBe(2);
    expect(createPunctualOccurrences).toHaveBeenCalledWith(
      'ckvexp000000000000000000w',
      [
        { date: new Date('2026-08-01T00:00:00.000Z'), startTime: '10:00' },
        { date: new Date('2026-08-02T00:00:00.000Z'), startTime: '16:00' },
      ]
    );
  });

  it('rejects malformed punctual picks', async () => {
    const result = await addPunctualOccurrences({
      experienceId: 'ckvexp000000000000000000w',
      picks: [{ date: '01/08/2026', startTime: '10:00' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
