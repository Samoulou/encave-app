import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn(), findFirst: vi.fn() },
    experience: { findFirst: vi.fn() },
    eventParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock('@/server/actions/experience-helpers', () => ({
  invalidateExperienceCaches: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { invalidateExperienceCaches } =
  await import('@/server/actions/experience-helpers');
const {
  addEventParticipant,
  removeEventParticipant,
  reorderEventParticipants,
} = await import('@/server/actions/eventParticipant');

const cuid = (label: string) => `c${label.padEnd(24, '0')}`;
const EXP = cuid('exp');
const ORG_WINERY = cuid('orgwinery');
const TARGET_WINERY = cuid('targetwinery');
const PARTICIPANT = cuid('participant');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

const organizerWinery = {
  id: ORG_WINERY,
  slug: 'org-cave',
  status: 'VERIFIED',
};
const ownedExperience = { id: EXP, slug: 'jardin', wineryId: ORG_WINERY };
// Eligible target: the add action now resolves it via findFirst (which
// applies the eligibility where-clause) and only checks for a truthy row.
const verifiedTarget = { id: TARGET_WINERY };

describe('addEventParticipant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    // Owner gate (resolveOwnedExperience) reads findUnique; the target
    // eligibility check reads findFirst.
    vi.mocked(db.winery.findUnique).mockResolvedValue(organizerWinery as never);
    vi.mocked(db.winery.findFirst).mockResolvedValue(verifiedTarget as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue(
      ownedExperience as never
    );
    vi.mocked(db.eventParticipant.findUnique).mockResolvedValue(null);
    vi.mocked(db.eventParticipant.aggregate).mockResolvedValue({
      _max: { order: 1 },
    } as never);
    vi.mocked(db.eventParticipant.create).mockResolvedValue({
      id: PARTICIPANT,
    } as never);
  });

  const validInput = {
    experienceId: EXP,
    wineryId: TARGET_WINERY,
    description: 'Vins de garde',
  };

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await addEventParticipant(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('is FORBIDDEN when the COLLECTIVE_EVENTS flag is off', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await addEventParticipant(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input (non-cuid winery id)', async () => {
    const result = await addEventParticipant({
      ...validInput,
      wineryId: 'not-a-cuid',
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('is FORBIDDEN when the caller does not own a verified winery', async () => {
    vi.mocked(db.winery.findUnique).mockReset();
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);
    const result = await addEventParticipant(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('rejects the organizing winery as its own participant', async () => {
    const result = await addEventParticipant({
      ...validInput,
      wineryId: ORG_WINERY,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('rejects a target winery that is not eligible', async () => {
    // findFirst applies the eligibility where-clause, so an ineligible
    // (suspended / unverified) target resolves to null.
    vi.mocked(db.winery.findFirst).mockResolvedValue(null);
    const result = await addEventParticipant(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.eventParticipant.create).not.toHaveBeenCalled();
  });

  it('adds the participant and invalidates caches (happy path)', async () => {
    const result = await addEventParticipant(validInput);
    expect(result).toMatchObject({
      success: true,
      data: { participantId: PARTICIPANT },
    });
    expect(db.eventParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experienceId: EXP,
          wineryId: TARGET_WINERY,
          order: 2, // (max 1) + 1
        }),
      })
    );
    expect(invalidateExperienceCaches).toHaveBeenCalledWith(
      'org-cave',
      'jardin'
    );
  });
});

describe('removeEventParticipant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await removeEventParticipant({ participantId: PARTICIPANT });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.eventParticipant.delete).not.toHaveBeenCalled();
  });

  it('is NOT_FOUND when the participant does not exist', async () => {
    vi.mocked(db.eventParticipant.findUnique).mockResolvedValue(null);
    const result = await removeEventParticipant({ participantId: PARTICIPANT });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('is FORBIDDEN when the participant belongs to another owner', async () => {
    vi.mocked(db.eventParticipant.findUnique).mockResolvedValue({
      id: PARTICIPANT,
      experience: {
        slug: 'jardin',
        winery: { userId: 'someone-else', slug: 'org-cave' },
      },
    } as never);
    const result = await removeEventParticipant({ participantId: PARTICIPANT });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.eventParticipant.delete).not.toHaveBeenCalled();
  });

  it('removes the participant (happy path)', async () => {
    vi.mocked(db.eventParticipant.findUnique).mockResolvedValue({
      id: PARTICIPANT,
      experience: {
        slug: 'jardin',
        winery: { userId: session.user.id, slug: 'org-cave' },
      },
    } as never);
    vi.mocked(db.eventParticipant.delete).mockResolvedValue({} as never);
    const result = await removeEventParticipant({ participantId: PARTICIPANT });
    expect(result).toMatchObject({ success: true, data: { removed: true } });
    expect(db.eventParticipant.delete).toHaveBeenCalledWith({
      where: { id: PARTICIPANT },
    });
    expect(invalidateExperienceCaches).toHaveBeenCalledWith(
      'org-cave',
      'jardin'
    );
  });
});

describe('reorderEventParticipants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(db.winery.findUnique).mockResolvedValue(organizerWinery as never);
    vi.mocked(db.experience.findFirst).mockResolvedValue(
      ownedExperience as never
    );
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await reorderEventParticipants({
      experienceId: EXP,
      items: [{ participantId: PARTICIPANT, order: 0 }],
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects an item that does not belong to the event', async () => {
    vi.mocked(db.eventParticipant.findMany).mockResolvedValue([
      { id: PARTICIPANT },
    ] as never);
    const result = await reorderEventParticipants({
      experienceId: EXP,
      items: [{ participantId: cuid('other'), order: 0 }],
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('reorders participants (happy path)', async () => {
    vi.mocked(db.eventParticipant.findMany).mockResolvedValue([
      { id: PARTICIPANT },
      { id: cuid('second') },
    ] as never);
    vi.mocked(db.$transaction).mockResolvedValue([] as never);
    const result = await reorderEventParticipants({
      experienceId: EXP,
      items: [
        { participantId: cuid('second'), order: 0 },
        { participantId: PARTICIPANT, order: 1 },
      ],
    });
    expect(result).toMatchObject({ success: true, data: { reordered: true } });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(invalidateExperienceCaches).toHaveBeenCalledWith(
      'org-cave',
      'jardin'
    );
  });
});
