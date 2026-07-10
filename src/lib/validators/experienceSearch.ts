import { z } from 'zod';
import { ExperienceType } from '@prisma/client';
import { isDateKey } from '@/lib/utils/date-key';
import { CATALOG_SORT_VALUES } from '@/lib/utils/search-params';

/**
 * Input of the public catalogue search action (P-06 / D2): the /experiences
 * page is static — filtered views are fetched client-side through
 * `searchExperiencesAction`, so this input crosses a trust boundary and
 * every field is bounded.
 */

const dateKeySchema = z
  .string()
  .refine(isDateKey, 'Expected a valid YYYY-MM-DD date');

export const experienceSearchSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    type: z.array(z.nativeEnum(ExperienceType)).max(10).optional(),
    commune: z.string().trim().max(100).optional(),
    minPrice: z.number().int().min(0).max(1_000_000).optional(),
    maxPrice: z.number().int().min(0).max(1_000_000).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    sort: z.enum(CATALOG_SORT_VALUES).optional(),
    page: z.number().int().min(1).max(500).optional(),
    availableFrom: dateKeySchema.optional(),
    availableTo: dateKeySchema.optional(),
    location: z.string().trim().max(200).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine(
    (value) =>
      value.availableTo === undefined ||
      (value.availableFrom !== undefined &&
        value.availableTo >= value.availableFrom),
    { message: 'availableTo requires availableFrom and must not precede it' }
  );

export type ExperienceSearchInput = z.infer<typeof experienceSearchSchema>;
