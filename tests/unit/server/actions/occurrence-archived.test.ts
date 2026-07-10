import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceStatus, OccurrenceStatus } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    experienceOccurrence: { findFirst: vi.fn(), update: vi.fn() },
    experience: { findFirst: vi.fn() },
  },
}));

vi.mock('@/server/services/occurrence.service', () => ({
  createPunctualOccurrences: vi.fn(),
}));

vi.mock('@/server/actions/experience-helpers', () => ({
  invalidateExperienceCaches: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { createPunctualOccurrences } =
  await import('@/server/services/occurrence.service');
const {
  closeOccurrence,
  reopenOccurrence,
  setOccurrenceCapacity,
  addPunctualOccurrences,
} = await import('@/server/actions/occurrence');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

const OCC_ID = 'cjld2cjxh0000qzrmn831i7rn';
const EXP_ID = 'cjld2cyuq0000t3rmniod1foy';

function archivedOccurrence(status: OccurrenceStatus = OccurrenceStatus.OPEN) {
  return {
    id: OCC_ID,
    status,
    experienceId: EXP_ID,
    experience: {
      slug: 'degustation',
      status: ExperienceStatus.ARCHIVED,
      maxCapacity: 8,
      winery: { slug: 'cave-test' },
    },
  };
}

/**
 * P-13 (P-05 debt): occurrence management on an ARCHIVED experience must
 * be refused SERVER-SIDE — the UI canEdit gate alone was bypassable.
 */
describe('occurrence actions — ARCHIVED experience gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
  });

  it('closeOccurrence refuses with CONFLICT', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      archivedOccurrence() as never
    );
    const result = await closeOccurrence({ occurrenceId: OCC_ID });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.experienceOccurrence.update).not.toHaveBeenCalled();
  });

  it('reopenOccurrence refuses with CONFLICT', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      archivedOccurrence(OccurrenceStatus.CLOSED) as never
    );
    const result = await reopenOccurrence({ occurrenceId: OCC_ID });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.experienceOccurrence.update).not.toHaveBeenCalled();
  });

  it('setOccurrenceCapacity refuses with CONFLICT', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      archivedOccurrence() as never
    );
    const result = await setOccurrenceCapacity({
      occurrenceId: OCC_ID,
      capacityOverride: 4,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.experienceOccurrence.update).not.toHaveBeenCalled();
  });

  it('addPunctualOccurrences refuses with CONFLICT', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: EXP_ID,
      slug: 'degustation',
      status: ExperienceStatus.ARCHIVED,
      winery: { slug: 'cave-test' },
    } as never);
    const result = await addPunctualOccurrences({
      experienceId: EXP_ID,
      picks: [{ date: '2026-08-01', startTime: '10:00' }],
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(createPunctualOccurrences).not.toHaveBeenCalled();
  });

  it('a PUBLISHED experience still passes (control)', async () => {
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue({
      ...archivedOccurrence(),
      experience: {
        slug: 'degustation',
        status: ExperienceStatus.PUBLISHED,
        maxCapacity: 8,
        winery: { slug: 'cave-test' },
      },
    } as never);
    vi.mocked(db.experienceOccurrence.update).mockResolvedValue({
      status: OccurrenceStatus.CLOSED,
    } as never);
    const result = await closeOccurrence({ occurrenceId: OCC_ID });
    expect(result).toMatchObject({ success: true });
  });
});
