/**
 * Quality lot (audit B3) — which cache tags each mutation fires.
 *
 * Three levels (src/lib/utils/cache-tags.ts):
 *  - `experiences` / `wineries`      → every public page (listing change);
 *  - `experiences:availability`      → home + catalogue search cache only;
 *  - `experience:{slug}` / `winery:{slug}` → that fiche only.
 *
 * A slot / occurrence / blocked-date edit used to fire the broad
 * `experiences` tag and cold-start the whole public tree. These tests pin
 * the matrix: an availability edit must NOT fire a broad tag, a listing
 * change MUST.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OccurrenceStatus } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
    experience: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    availabilitySlot: { findFirst: vi.fn(), update: vi.fn() },
    blockedDate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    experienceOccurrence: { findFirst: vi.fn(), update: vi.fn() },
    wine: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/services/occurrence.service', () => ({
  generateOccurrences: vi.fn(async () => ({ created: 0 })),
  closeOrphanedRecurringOccurrences: vi.fn(async () => ({ closed: 0 })),
  createPunctualOccurrences: vi.fn(async () => ({ created: 1 })),
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(async () => true),
}));

vi.mock('@/lib/constants/time-slots', () => ({
  hasOverlappingSlots: vi.fn(() => false),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { revalidateTag, revalidatePath } = await import('next/cache');
const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const {
  invalidateExperienceCaches,
  invalidateExperienceAvailabilityCaches,
  invalidateWineryDetailCache,
  invalidateEventParticipantsCache,
} = await import('@/server/actions/experience-helpers');
const { updateAvailabilitySlots, toggleSlotActive } =
  await import('@/server/actions/availability-slots');
const {
  blockDate,
  unblockDate,
  blockDateForAllExperiences,
  unblockDateForAllExperiences,
} = await import('@/server/actions/availability-blocked-dates');
const { closeOccurrence, reopenOccurrence, setOccurrenceCapacity } =
  await import('@/server/actions/occurrence');
const { createWine } = await import('@/server/actions/wine');
const { publishExperience, unpublishExperience } =
  await import('@/server/actions/experience-status');

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

const BROAD_TAGS = ['experiences', 'wineries'];
const OCC_ID = 'cjld2cjxh0000qzrmn831i7rn';

/** Tags fired since the last reset, without the forward-compat scaffolding. */
function firedTags(): string[] {
  return vi
    .mocked(revalidateTag)
    .mock.calls.map(([tag]) => tag)
    .filter((tag) => !tag.startsWith('occurrences:'))
    .sort();
}

function expectNoBroadTag() {
  for (const tag of BROAD_TAGS) {
    expect(firedTags()).not.toContain(tag);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session);
});

describe('invalidation helpers', () => {
  it('broad: experiences (+ the entity tags when slugs are given)', () => {
    invalidateExperienceCaches();
    expect(firedTags()).toEqual(['experiences']);

    vi.mocked(revalidateTag).mockClear();
    invalidateExperienceCaches('cave-a', 'degustation');
    expect(firedTags()).toEqual([
      'experience:degustation',
      'experiences',
      'winery:cave-a',
    ]);
  });

  it('availability: the fiche(s) + the catalogue availability cache, nothing broad', () => {
    invalidateExperienceAvailabilityCaches('degustation');
    expect(firedTags()).toEqual([
      'experience:degustation',
      'experiences:availability',
    ]);

    vi.mocked(revalidateTag).mockClear();
    invalidateExperienceAvailabilityCaches(['a', 'b', 'a', '']);
    expect(firedTags()).toEqual([
      'experience:a',
      'experience:b',
      'experiences:availability',
    ]);
    expectNoBroadTag();
  });

  it('event participants: that grid and its fiche only', () => {
    invalidateEventParticipantsCache('exp-1', 'fete-des-vendanges');
    expect(firedTags()).toEqual([
      'experience-participants:exp-1',
      'experience:fete-des-vendanges',
    ]);
    expectNoBroadTag();
  });

  it('winery detail: that fiche only', () => {
    invalidateWineryDetailCache('cave-a');
    expect(firedTags()).toEqual(['winery:cave-a']);
  });
});

describe('availability mutations stay off the broad tags', () => {
  const AVAILABILITY_ONLY = [
    'experience:degustation',
    'experiences:availability',
  ];

  it('updateAvailabilitySlots', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'w-1' } as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation',
    } as never);
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);

    const result = await updateAvailabilitySlots('exp-1', [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
    ]);

    expect(result.success).toBe(true);
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);
    expectNoBroadTag();
  });

  it('toggleSlotActive', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'w-1' } as never);
    vi.mocked(db.availabilitySlot.findFirst).mockResolvedValue({
      id: 'slot-1',
      experienceId: 'exp-1',
      experience: { wineryId: 'w-1', slug: 'degustation' },
    } as never);
    vi.mocked(db.availabilitySlot.update).mockResolvedValue({} as never);

    const result = await toggleSlotActive('slot-1', false);

    expect(result.success).toBe(true);
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);
  });

  it('blockDate / unblockDate', async () => {
    vi.mocked(db.experience.findUnique).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation',
      winery: { userId: 'owner-1' },
    } as never);
    vi.mocked(db.blockedDate.findUnique).mockResolvedValue(null);
    vi.mocked(db.blockedDate.create).mockResolvedValue({
      id: 'bd-1',
      experienceId: 'exp-1',
      date: new Date('2099-01-20'),
      reason: null,
    } as never);

    const blocked = await blockDate('exp-1', new Date('2099-01-20'));
    expect(blocked.success).toBe(true);
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);

    vi.mocked(revalidateTag).mockClear();
    vi.mocked(db.blockedDate.deleteMany).mockResolvedValue({
      count: 1,
    } as never);
    const unblocked = await unblockDate('exp-1', new Date('2099-01-20'));
    expect(unblocked.success).toBe(true);
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);
  });

  it('block / unblock for all experiences: every fiche of THIS winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'w-1',
      experiences: [
        { id: 'exp-1', slug: 'degustation' },
        { id: 'exp-2', slug: 'visite' },
      ],
    } as never);
    vi.mocked(db.blockedDate.createMany).mockResolvedValue({
      count: 2,
    } as never);

    const blocked = await blockDateForAllExperiences(new Date('2099-01-20'));
    expect(blocked.success).toBe(true);
    expect(firedTags()).toEqual([
      'experience:degustation',
      'experience:visite',
      'experiences:availability',
    ]);

    vi.mocked(revalidateTag).mockClear();
    vi.mocked(db.blockedDate.deleteMany).mockResolvedValue({
      count: 2,
    } as never);
    const unblocked = await unblockDateForAllExperiences(
      new Date('2099-01-20')
    );
    expect(unblocked.success).toBe(true);
    expect(firedTags()).toEqual([
      'experience:degustation',
      'experience:visite',
      'experiences:availability',
    ]);
    expectNoBroadTag();
  });

  it('close / reopen / capacity of an occurrence', async () => {
    const owned = (status: OccurrenceStatus) => ({
      id: OCC_ID,
      status,
      experienceId: 'exp-1',
      experience: {
        slug: 'degustation',
        status: 'PUBLISHED',
        maxCapacity: 8,
        winery: { slug: 'cave-a' },
      },
    });

    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      owned(OccurrenceStatus.OPEN) as never
    );
    vi.mocked(db.experienceOccurrence.update).mockResolvedValue({
      status: OccurrenceStatus.CLOSED,
      capacityOverride: 4,
    } as never);
    expect((await closeOccurrence({ occurrenceId: OCC_ID })).success).toBe(
      true
    );
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);

    vi.mocked(revalidateTag).mockClear();
    vi.mocked(db.experienceOccurrence.findFirst).mockResolvedValue(
      owned(OccurrenceStatus.CLOSED) as never
    );
    expect((await reopenOccurrence({ occurrenceId: OCC_ID })).success).toBe(
      true
    );
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);

    vi.mocked(revalidateTag).mockClear();
    expect(
      (
        await setOccurrenceCapacity({
          occurrenceId: OCC_ID,
          capacityOverride: 4,
        })
      ).success
    ).toBe(true);
    expect(firedTags()).toEqual(AVAILABILITY_ONLY);
    expectNoBroadTag();
  });
});

describe('detail-only mutation', () => {
  it('createWine purges the winery fiche alone', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'w-1',
      slug: 'cave-a',
    } as never);
    vi.mocked(db.wine.create).mockResolvedValue({ id: 'wine-1' } as never);

    const result = await createWine({
      name: 'Petite Arvine',
      grapeVariety: 'Petite Arvine',
      vintage: 2024,
      price: 2800,
      available: true,
    });

    expect(result.success).toBe(true);
    expect(firedTags()).toEqual(['winery:cave-a']);
  });
});

describe('listing mutations keep the broad tags', () => {
  it('publishExperience', async () => {
    vi.mocked(db.winery.findUnique)
      .mockResolvedValueOnce({
        id: 'w-1',
        status: 'VERIFIED',
        stripeAccountId: 'acct_1',
        stripeOnboardingComplete: true,
      } as never)
      .mockResolvedValueOnce({ slug: 'cave-a' } as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation',
      status: 'DRAFT',
    } as never);
    vi.mocked(db.experience.update).mockResolvedValue({} as never);

    const result = await publishExperience('exp-1');

    expect(result.success).toBe(true);
    expect(firedTags()).toEqual(
      expect.arrayContaining(['experiences', 'wineries'])
    );
  });

  it('unpublishExperience', async () => {
    vi.mocked(db.winery.findUnique)
      .mockResolvedValueOnce({ id: 'w-1', status: 'VERIFIED' } as never)
      .mockResolvedValueOnce({ slug: 'cave-a' } as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation',
      status: 'PUBLISHED',
    } as never);
    vi.mocked(db.experience.update).mockResolvedValue({} as never);

    const result = await unpublishExperience('exp-1');

    expect(result.success).toBe(true);
    expect(firedTags()).toEqual(
      expect.arrayContaining(['experiences', 'wineries'])
    );
  });
});

describe('public routes are never path-revalidated', () => {
  it('none of the mutations above called revalidatePath', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'w-1' } as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      slug: 'degustation',
    } as never);
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);
    await updateAvailabilitySlots('exp-1', []);

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
