import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from '@/server/db';
import { getExperienceOperationalContext } from '@/server/queries/event-detail.queries';
import { ExperienceStatus } from '@prisma/client';

describe('getExperienceOperationalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the experience is not found / not owned', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(null);

    const result = await getExperienceOperationalContext('exp-1', 'u1');

    expect(result).toBeNull();
    // Tenant gate: the where clause must scope on the owner's userId.
    const call = vi.mocked(db.experience.findFirst).mock.calls[0]?.[0];
    expect(call).toMatchObject({
      where: { id: 'exp-1', winery: { userId: 'u1' } },
    });
  });

  it('maps the owner context DTO including the winery name', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      title: 'Dégustation verticale',
      slug: 'degustation-verticale',
      status: ExperienceStatus.PUBLISHED,
      duration: 90,
      maxCapacity: 10,
      winery: { name: 'Domaine X' },
    } as never);

    const result = await getExperienceOperationalContext('exp-1', 'u1');

    expect(result).toEqual({
      id: 'exp-1',
      title: 'Dégustation verticale',
      slug: 'degustation-verticale',
      status: ExperienceStatus.PUBLISHED,
      duration: 90,
      maxCapacity: 10,
      wineryName: 'Domaine X',
    });
  });
});
