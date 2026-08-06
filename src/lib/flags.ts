/**
 * Feature-flag registry (P-03, delivery plan rule 3).
 *
 * Every money-touching feature ships behind one of these kill-switches,
 * OFF by default. The runtime state lives in the `feature_flags` table,
 * read through a 60s cache (`src/server/queries/feature-flags.queries.ts`)
 * and toggled from the admin (`setFeatureFlag` action — revalidates the
 * cache tag, so the switch is effective immediately). A missing row means
 * the default below (always OFF — with ONE documented exception).
 *
 * This module is PURE (importable from client and server components) —
 * no db, no env.
 *
 * ONE flag lives OUTSIDE this registry: `COMING_SOON` (env var, P-16 /
 * WS-I) gates encave.ch behind the Coming Soon page from the Edge
 * middleware, which cannot reach the DB. Flip = Vercel env change +
 * redeploy. Every other flag belongs here — don't add env flags.
 */

export const FLAG_REGISTRY = {
  /** 2.50 CHF/ticket client booking fee, separate checkout line (L-041). */
  BOOKING_FEE: { defaultEnabled: false },
  /** Gift cards purchase/redemption (P-09). */
  GIFT_CARDS: { defaultEnabled: false },
  /** Card-imprint no-show fees (P-08). */
  NO_SHOW_FEES: { defaultEnabled: false },
  /** Sur-mesure requests (P-10). */
  REQUESTS: { defaultEnabled: false },
  /** Tasting sheet + J+2 email loop (P-07). */
  TASTING_SHEET: { defaultEnabled: false },
  /** Collective events (P-11). */
  COLLECTIVE_EVENTS: { defaultEnabled: false },
  /**
   * ⚠️ INVERTED semantics — the registry's only default-ON flag.
   * Occurrence-authoritative capacity (P-05 / ADR-0002): capacityOverride
   * + OPEN/blackout gate on the booking path. OFF = emergency fallback to
   * the P-04 behavior (maxCapacity, no status gate); seat COUNTING is
   * identical in both states, so flipping can never oversell.
   */
  OCCURRENCE_CAPACITY: { defaultEnabled: true },
} as const;

export type FlagKey = keyof typeof FLAG_REGISTRY;

export const FLAG_KEYS = Object.keys(FLAG_REGISTRY) as FlagKey[];

export function isFlagKey(value: string): value is FlagKey {
  return value in FLAG_REGISTRY;
}
