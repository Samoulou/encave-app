'use server';

import { headers } from 'next/headers';
import {
  searchExperiences,
  type ExperienceSearchResult,
} from '@/server/queries/experience.queries';
import { experienceSearchSchema } from '@/lib/validators/experienceSearch';
import {
  API_RATE_LIMIT,
  checkRateLimit,
} from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

export interface ExperienceSearchData {
  experiences: ExperienceSearchResult[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  locationSearch: {
    hasLocationSearch: boolean;
    locationName?: string;
  };
}

/**
 * Public read action behind the static catalogue (P-06 / D2): the
 * /experiences page is prerendered with the DEFAULT dataset; every
 * filtered view is fetched here client-side. No auth (public data), but
 * rate-limited per IP — it is a public endpoint. The underlying
 * searchExperiences stays unstable_cache'd (tag 'experiences'), so the
 * DB load is bounded exactly as before.
 */
export async function searchExperiencesAction(
  input: unknown
): Promise<ActionResult<ExperienceSearchData>> {
  const parsed = experienceSearchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid search input' },
    };
  }

  const ip =
    (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rateLimit = await checkRateLimit(`search:${ip}`, API_RATE_LIMIT);
  if (!rateLimit.success) {
    return {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many search requests' },
    };
  }

  try {
    const result = await searchExperiences(parsed.data);
    return {
      success: true,
      data: {
        experiences: result.experiences,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        locationSearch: {
          hasLocationSearch: result.hasLocationSearch,
          locationName: result.locationName,
        },
      },
    };
  } catch (error) {
    logError('searchExperiencesAction failed', error, {
      action: 'searchExperiencesAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Search failed' },
    };
  }
}
