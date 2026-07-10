/**
 * Occurrence EAGER-generation horizon (P-05 / ADR-0002, decision D-B).
 * 6 weeks aligns with the US-101 acceptance example (sat 10h/16h → 12
 * occurrences = 2/week × 6 weeks). This bounds pre-materialization only
 * (calendar preview, date search) — NOT the booking window: any future
 * date backed by an active weekly slot materializes on demand at hold
 * time (resolveOccurrence). Product-tunable (Sam) — the DoD count
 * follows the value.
 */
export const OCCURRENCE_HORIZON_DAYS = 42;

/** Live preview length in the availability builder (L-131). */
export const OCCURRENCE_PREVIEW_COUNT = 8;

/**
 * Per-occurrence capacity override bounds (L-132) — mirrored by the DB
 * CHECK (>= 1) and the Zod schema; the UI stepper imports these.
 */
export const OCCURRENCE_CAPACITY_MIN = 1;
export const OCCURRENCE_CAPACITY_MAX = 50;
