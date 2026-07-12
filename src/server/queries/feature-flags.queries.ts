import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';
import { FLAG_KEYS, FLAG_REGISTRY, isFlagKey, type FlagKey } from '@/lib/flags';

export const FEATURE_FLAGS_CACHE_TAG = 'feature-flags';

/**
 * Current state of every registered flag. Missing rows fall back to the
 * registry default (OFF). Cached 60s — the admin toggle revalidates the
 * tag, which since P-06 ALSO purges the ISR pages that consumed it
 * (verified: fiche flips <1 min — the kill-switch DoD path). A direct
 * SQL flip without the toggle worst-cases at ~60s data cache + the
 * page's revalidate TTL (300s): use the admin toggle in an incident.
 */
export const getFeatureFlags = cache(
  unstable_cache(
    async (): Promise<Record<FlagKey, boolean>> => {
      const rows = await db.featureFlag.findMany({
        select: { key: true, enabled: true },
      });
      const state = {} as Record<FlagKey, boolean>;
      for (const key of FLAG_KEYS) {
        state[key] = FLAG_REGISTRY[key].defaultEnabled;
      }
      for (const row of rows) {
        if (isFlagKey(row.key)) {
          state[row.key] = row.enabled;
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
