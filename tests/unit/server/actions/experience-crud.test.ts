import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';
import type { CreateExperienceInput } from '@/lib/validators/experience';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

const tx = {
  experience: { create: vi.fn(), update: vi.fn() },
  experienceGalleryImage: { createMany: vi.fn(), deleteMany: vi.fn() },
  availabilitySlot: { createMany: vi.fn() },
};

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
    experience: { findFirst: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { revalidateTag } = await import('next/cache');
const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { createExperience, updateExperience, deleteExperience } =
  await import('@/server/actions/experience-crud');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
    emailVerified: true,
  },
};

const WINERY_ID = 'winery-1';
// A blob this winery uploaded (uploadExperienceImage → experiences/{id}/…).
const OWN_COVER = `https://abc123.public.blob.vercel-storage.com/experiences/${WINERY_ID}/1700000000000-cover.jpg`;
const OWN_GALLERY = `https://abc123.public.blob.vercel-storage.com/experiences/${WINERY_ID}/1700000000001-g1.jpg`;
const FOREIGN_IMAGE = 'https://tracker.example.com/pixel.gif';

const validInput: CreateExperienceInput = {
  title: 'Dégustation découverte',
  type: 'TASTING',
  description: 'x'.repeat(120),
  duration: 90,
  price: 45,
  minCapacity: 1,
  maxCapacity: 8,
};

function tags(): string[] {
  return vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session);
  vi.mocked(db.winery.findUnique).mockResolvedValue({
    id: WINERY_ID,
    status: 'VERIFIED',
    slug: 'cave-test',
  } as never);
  // No slug collision by default.
  vi.mocked(db.experience.findFirst).mockResolvedValue(null);
  vi.mocked(db.$transaction).mockImplementation((async (
    fn: (_tx: typeof tx) => unknown
  ) => fn(tx)) as never);
  tx.experience.create.mockResolvedValue({
    id: 'exp-1',
    slug: 'degustation-decouverte',
  });
  tx.experience.update.mockResolvedValue({
    id: 'exp-1',
    slug: 'degustation-decouverte',
  });
});

describe('createExperience', () => {
  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await createExperience(validInput, OWN_COVER);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty title', { title: '' }],
    ['a too-short description', { description: 'trop court' }],
    ['an unsupported duration', { duration: 75 }],
    ['a negative price', { price: -1 }],
    ['a zero capacity', { minCapacity: 0 }],
  ])('rejects %s (VALIDATION_ERROR) before any write', async (_, override) => {
    const result = await createExperience(
      { ...validInput, ...override } as CreateExperienceInput,
      OWN_COVER
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the user has no winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await createExperience(validInput, OWN_COVER);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it.each(['PENDING', 'REJECTED', 'SUSPENDED'])(
    'returns FORBIDDEN for a %s winery',
    async (status) => {
      vi.mocked(db.winery.findUnique).mockResolvedValue({
        id: WINERY_ID,
        status,
      } as never);

      const result = await createExperience(validInput, OWN_COVER);

      expect(result).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN' },
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    }
  );

  it('refuses an image URL the winery does not own', async () => {
    const cover = await createExperience(validInput, FOREIGN_IMAGE);
    const gallery = await createExperience(validInput, OWN_COVER, [
      FOREIGN_IMAGE,
    ]);

    for (const result of [cover, gallery]) {
      expect(result).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('creates a DRAFT with the price in cents, the gallery, the slots, and purges the listing caches', async () => {
    const result = await createExperience(
      {
        ...validInput,
        availabilitySlots: [
          {
            days: ['SAT', 'SUN'],
            timeSlots: [{ start: '10:00', end: '11:30' }],
          },
        ],
      },
      OWN_COVER,
      [OWN_GALLERY]
    );

    expect(result).toEqual({
      success: true,
      data: { experienceId: 'exp-1', slug: 'degustation-decouverte' },
    });
    expect(tx.experience.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        wineryId: WINERY_ID,
        title: 'Dégustation découverte',
        slug: 'degustation-decouverte',
        price: 4500,
        status: 'DRAFT',
        coverPhoto: OWN_COVER,
      }),
    });
    expect(tx.experienceGalleryImage.createMany).toHaveBeenCalledWith({
      data: [{ experienceId: 'exp-1', url: OWN_GALLERY, order: 0 }],
    });
    expect(tx.availabilitySlot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ dayOfWeek: 6, startTime: '10:00' }),
        expect.objectContaining({ dayOfWeek: 0, startTime: '10:00' }),
      ],
    });
    // A new experience changes the listings → broad tag.
    expect(tags()).toContain('experiences');
  });

  it('suffixes the slug when another experience (any winery) already uses it', async () => {
    vi.mocked(db.experience.findFirst)
      .mockResolvedValueOnce({ id: 'other-winery-exp' } as never)
      .mockResolvedValueOnce(null);

    await createExperience(validInput, OWN_COVER);

    // The uniqueness check is global: no wineryId in the predicate.
    expect(db.experience.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'degustation-decouverte' } })
    );
    expect(tx.experience.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: 'degustation-decouverte-1' }),
    });
  });

  it('never throws: a DB failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(db.$transaction).mockRejectedValue(new Error('db down'));

    const result = await createExperience(validInput, OWN_COVER);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});

describe('updateExperience', () => {
  const existing = {
    id: 'exp-1',
    title: 'Dégustation découverte',
    slug: 'degustation-decouverte',
    coverPhoto: 'https://images.unsplash.com/legacy-cover.jpg',
    galleryImages: [{ url: OWN_GALLERY }],
  };

  beforeEach(() => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(existing as never);
  });

  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await updateExperience('exp-1', validInput, OWN_COVER);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects invalid input (VALIDATION_ERROR)', async () => {
    const result = await updateExperience(
      'exp-1',
      { ...validInput, description: 'court' },
      OWN_COVER
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN for an unverified winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: WINERY_ID,
      status: 'SUSPENDED',
    } as never);

    const result = await updateExperience('exp-1', validInput, OWN_COVER);

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it("scopes the lookup to the caller's winery (NOT_FOUND otherwise)", async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(null);

    const result = await updateExperience('exp-x', validInput, OWN_COVER);

    expect(db.experience.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-x', wineryId: WINERY_ID },
      })
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a NEW foreign image but keeps an already stored legacy one', async () => {
    const foreign = await updateExperience('exp-1', validInput, FOREIGN_IMAGE);
    expect(foreign).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();

    const legacy = await updateExperience(
      'exp-1',
      validInput,
      existing.coverPhoto,
      [OWN_GALLERY]
    );
    expect(legacy.success).toBe(true);
  });

  it('updates in place, keeps the slug when the title is unchanged, replaces the gallery', async () => {
    const result = await updateExperience(
      'exp-1',
      { ...validInput, price: 52.5 },
      OWN_COVER,
      [OWN_GALLERY]
    );

    expect(result).toEqual({
      success: true,
      data: { experienceId: 'exp-1', slug: 'degustation-decouverte' },
    });
    expect(tx.experienceGalleryImage.deleteMany).toHaveBeenCalledWith({
      where: { experienceId: 'exp-1' },
    });
    expect(tx.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: expect.objectContaining({
        slug: 'degustation-decouverte',
        price: 5250,
        coverPhoto: OWN_COVER,
      }),
    });
    // Title/price/cover are listing data → broad tag.
    expect(tags()).toContain('experiences');
  });

  it('re-slugs on a title change, excluding itself from the uniqueness check', async () => {
    vi.mocked(db.experience.findFirst)
      .mockResolvedValueOnce(existing as never) // ownership lookup
      .mockResolvedValueOnce(null); // slug free
    tx.experience.update.mockResolvedValue({
      id: 'exp-1',
      slug: 'atelier-assemblage',
    });

    const result = await updateExperience(
      'exp-1',
      { ...validInput, title: 'Atelier assemblage' },
      OWN_COVER
    );

    expect(result).toMatchObject({
      success: true,
      data: { slug: 'atelier-assemblage' },
    });
    expect(db.experience.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { slug: 'atelier-assemblage', id: { not: 'exp-1' } },
      })
    );
    // Both the new and the old fiche are purged.
    expect(tags()).toEqual(
      expect.arrayContaining([
        'experience:atelier-assemblage',
        'experience:degustation-decouverte',
      ])
    );
  });
});

describe('deleteExperience', () => {
  beforeEach(() => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation-decouverte',
      _count: { bookings: 0 },
    } as never);
    vi.mocked(db.experience.delete).mockResolvedValue({} as never);
  });

  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await deleteExperience('exp-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.experience.delete).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN for a missing or unverified winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: WINERY_ID,
      status: 'PENDING',
      slug: 'cave-test',
    } as never);

    const result = await deleteExperience('exp-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.experience.delete).not.toHaveBeenCalled();
  });

  it("cannot delete another winery's experience (NOT_FOUND)", async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(null);

    const result = await deleteExperience('exp-of-another-winery');

    expect(db.experience.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-of-another-winery', wineryId: WINERY_ID },
      })
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.experience.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete an experience that still has seat-holding bookings', async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation-decouverte',
      _count: { bookings: 2 },
    } as never);

    const result = await deleteExperience('exp-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'HAS_BOOKINGS' },
    });
    expect(db.experience.delete).not.toHaveBeenCalled();
  });

  it('deletes and purges the listing caches', async () => {
    const result = await deleteExperience('exp-1');

    expect(result).toEqual({ success: true, data: { deleted: true } });
    expect(db.experience.delete).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
    });
    expect(tags()).toEqual(
      expect.arrayContaining([
        'experiences',
        'experience:degustation-decouverte',
        'winery:cave-test',
      ])
    );
  });
});
