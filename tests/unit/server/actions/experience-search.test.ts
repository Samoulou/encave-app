import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.7' })),
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  API_RATE_LIMIT: { maxRequests: 60, windowMs: 60_000 },
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '203.0.113.7'),
}));

vi.mock('@/server/queries/experience.queries', () => ({
  searchExperiences: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { checkRateLimit } = await import('@/server/services/rate-limit.service');
const { searchExperiences } =
  await import('@/server/queries/experience.queries');
const { searchExperiencesAction } =
  await import('@/server/actions/experience-search');

const allowed = { success: true, remaining: 59, resetAt: Date.now() + 60_000 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue(allowed as never);
  vi.mocked(searchExperiences).mockResolvedValue({
    experiences: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
    hasLocationSearch: false,
  });
});

/**
 * Public, unauthenticated read action (CLAUDE.md exception to the auth
 * rule): its contract is input validation + per-IP rate limiting.
 */
describe('searchExperiencesAction', () => {
  it('needs no session: an anonymous visitor gets results', async () => {
    const result = await searchExperiencesAction({ sort: 'newest' });

    expect(result).toEqual({
      success: true,
      data: {
        experiences: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        locationSearch: { hasLocationSearch: false, locationName: undefined },
      },
    });
    expect(searchExperiences).toHaveBeenCalledWith({ sort: 'newest' });
  });

  it.each([
    ['a non-object payload', 'fendant'],
    ['an unknown sort', { sort: 'cheapest' }],
    ['an out-of-range page', { page: 0 }],
    ['an oversized search term', { search: 'x'.repeat(201) }],
    ['an invalid experience type', { type: ['SKYDIVING'] }],
    ['a malformed date', { availableFrom: '2026-02-31' }],
    ['availableTo without availableFrom', { availableTo: '2026-12-01' }],
    ['a latitude out of range', { lat: 120, lng: 7 }],
  ])(
    'rejects %s before touching the rate limiter or the DB',
    async (_, input) => {
      const result = await searchExperiencesAction(input);

      expect(result).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(searchExperiences).not.toHaveBeenCalled();
    }
  );

  it('is rate-limited per IP', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    } as never);

    const result = await searchExperiencesAction({ sort: 'newest' });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMITED' },
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'search:203.0.113.7',
      expect.objectContaining({ maxRequests: 60 })
    );
    expect(searchExperiences).not.toHaveBeenCalled();
  });

  it('passes only the validated, trimmed input to the query', async () => {
    await searchExperiencesAction({
      search: '  petite arvine ',
      type: ['TASTING'],
      page: 2,
      injected: 'DROP TABLE',
    });

    expect(searchExperiences).toHaveBeenCalledWith({
      search: 'petite arvine',
      type: ['TASTING'],
      page: 2,
    });
  });

  it('never throws: a query failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(searchExperiences).mockRejectedValue(new Error('db down'));

    const result = await searchExperiencesAction({ sort: 'newest' });

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
