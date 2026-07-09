/**
 * Occurrence generation horizon (P-05 / ADR-0002, decision D-B).
 * 6 weeks aligns with the US-101 acceptance example (sat 10h/16h → 12
 * occurrences = 2/week × 6 weeks). This IS the client booking window:
 * beyond it no occurrence exists, so nothing is bookable. Product-tunable
 * (Sam) — the DoD count follows the value.
 */
export const OCCURRENCE_HORIZON_DAYS = 42;

/** Live preview length in the availability builder (L-131). */
export const OCCURRENCE_PREVIEW_COUNT = 8;
