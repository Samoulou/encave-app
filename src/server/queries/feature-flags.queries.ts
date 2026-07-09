import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import { FLAG_KEYS, FLAG_REGISTRY, type FlagKey } from '@/lib/flags';

export const FEATURE_FLAGS_CACHE_TAG = 'feature-flags';

/**
 * Current state of every registered flag. Missing rows fall back to the
 * registry default (OFF). Cached 60s — the admin toggle revalidates the
 * tag, so an admin kill-switch is effective immediately; a direct SQL
 * flip takes at most 60s (kill-switch DoD of P-03).
 */
export const getFeatureFlags = cache(
  unstable_cache(
    async (): Promise<Record<FlagKey, boolean>> => {
      const rows = await db.featureFlag.findMany();
      const state = {} as Record<FlagKey, boolean>;
      for (const key of FLAG_KEYS) {
        state[key] = FLAG_REGISTRY[key].defaultEnabled;
      }
      for (const row of rows) {
        const key = row.key as FlagKey;
        if (FLAG_KEYS.includes(key)) {
          state[key] = row.enabled;
        }
      }
      return state;
    },
    ['feature-flags'],
    { revalidate: 60, tags: [FEATURE_FLAGS_CACHE_TAG] }
  )
);

export async function isFlagEnabled(key: FlagKey): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key];
}
