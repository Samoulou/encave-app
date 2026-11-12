/**
 * Quality lot (audit B3 / B6) — tags and keys of the public cached reads.
 *
 * The global test setup makes `unstable_cache` a passthrough; this suite
 * replaces it with a recorder to pin, per read: the key parts, the tags,
 * and whether the persistent cache is used at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface CacheCall {
  keyParts: string[];
  tags: string[];
  revalidate: number | false | undefined;
  invocations: unknown[][];
}

const cacheCalls: CacheCall[] = [];

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (
    fn: (..._args: unknown[]) => unknown,
    keyParts: string[] = [],
    options: { tags?: string[]; revalidate?: number | false } = {}
  ) => {
    const record: CacheCall = {
      keyParts,
      tags: options.tags ?? [],
      revalidate: options.revalidate,
      invocations: [],
    };
    cacheCalls.push(record);
    return (...args: unknown[]) => {
      record.invocations.push(args);
      return fn(...args);
    };
  },
}));

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    winery: { findFirst: vi.fn(async () => null) },
    eventParticipant: { findMany: vi.fn(async () => []) },
    experienceOccurrence: { findMany: vi.fn(async () => []) },
    blockedDate: { findMany: vi.fn(async () => []) },
    booking: { groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
  },
}));

const { searchExperiences, getExperienceBySlug } =
  await import('@/server/queries/experience.queries');
const { getWineryBySlug } = await import('@/server/queries/winery.queries');
const { getEventParticipants } =
  await import('@/server/queries/event-participant.queries');

/** Wrappers that were actually INVOKED since the last reset. */
function invoked(): CacheCall[] {
  return cacheCalls.filter((call) => call.invocations.length > 0);
}

beforeEach(() => {
  for (const call of cacheCalls) call.invocations.length = 0;
});

describe('search cache', () => {
  it('plain listing: listing tag only (an availability edit leaves it cached)', async () => {
    await searchExperiences({ limit: 8 });

    const [call] = invoked();
    expect(invoked()).toHaveLength(1);
    expect(call?.keyParts).toEqual(['search-experiences']);
    expect(call?.tags).toEqual(['experiences']);
  });

  it('availability-dependent search carries experiences:availability', async () => {
    await searchExperiences({ sort: 'next_availability' });
    expect(invoked().map((call) => call.tags)).toEqual([
      ['experiences', 'experiences:availability'],
    ]);

    for (const call of cacheCalls) call.invocations.length = 0;
    await searchExperiences({ availableFrom: '2099-06-05', sort: 'newest' });
    expect(invoked().map((call) => call.tags)).toEqual([
      ['experiences', 'experiences:availability'],
    ]);
  });

  it('the cache key is the NORMALISED params object', async () => {
    await searchExperiences({ commune: ' Sion ', sort: 'newest' });

    expect(invoked()[0]?.invocations[0]).toEqual([
      { commune: 'Sion', sort: 'newest', page: 1, limit: 20 },
    ]);
  });

  it('free-text search bypasses the persistent cache entirely', async () => {
    await searchExperiences({ search: 'fendant', sort: 'newest' });
    await searchExperiences({ search: 'fendant', sort: 'next_availability' });

    expect(invoked()).toHaveLength(0);
  });
});

describe('entity reads', () => {
  it('getExperienceBySlug: slug in the key, listing + entity tag', async () => {
    await getExperienceBySlug('degustation-decouverte');

    const call = cacheCalls.find(
      (c) => c.keyParts[1] === 'degustation-decouverte'
    );
    expect(call?.keyParts).toEqual([
      'experience-by-slug-v3',
      'degustation-decouverte',
    ]);
    expect(call?.tags).toEqual([
      'experiences',
      'experience:degustation-decouverte',
    ]);
    expect(call?.revalidate).toBe(300);
  });

  it('getWineryBySlug: slug in the key, listing + entity tag', async () => {
    await getWineryBySlug('cave-des-tests');

    const call = cacheCalls.find((c) => c.keyParts[1] === 'cave-des-tests');
    expect(call?.keyParts).toEqual(['winery-by-slug-v3', 'cave-des-tests']);
    expect(call?.tags).toEqual(['wineries', 'winery:cave-des-tests']);
  });

  it('getEventParticipants: experience id in the key, listing + entity tag', async () => {
    await getEventParticipants('exp-42');

    const call = cacheCalls.find((c) => c.keyParts[1] === 'exp-42');
    expect(call?.keyParts).toEqual(['event-participants-v1', 'exp-42']);
    expect(call?.tags).toEqual([
      'experiences',
      'experience-participants:exp-42',
    ]);
  });

  it('two slugs never share a cache entry', async () => {
    await getExperienceBySlug('slug-a');
    await getExperienceBySlug('slug-b');

    const keys = cacheCalls
      .filter((c) => c.keyParts[0] === 'experience-by-slug-v3')
      .map((c) => c.keyParts.join('|'));
    expect(keys).toContain('experience-by-slug-v3|slug-a');
    expect(keys).toContain('experience-by-slug-v3|slug-b');
  });
});
