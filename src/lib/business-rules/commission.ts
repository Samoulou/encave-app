/**
 * Per-winery commission (P-03 / L-042, docs/v3/ENCAVE-V3-BUSINESS.md §2).
 *
 * The winery record is the source of truth: `commissionRate` is set by an
 * admin (0 for the ≤20 Founders until 31.03.2027). A null rate means the
 * platform default — the PLATFORM_COMMISSION_RATE env var (12% today;
 * the 10% launch rate is an env flip at launch, not code).
 *
 * Pure module: the caller passes the default rate (from env) so this
 * stays testable and importable anywhere.
 */

export type CommissionInput = {
  commissionRate: number | null;
};

/** Effective rate in [0, 1] for a winery (DB CHECK guarantees bounds). */
export function getEffectiveCommissionRate(
  winery: CommissionInput,
  defaultRate: number
): number {
  return winery.commissionRate ?? defaultRate;
}

/** Commission in cents on a booking subtotal (fee excluded), rounded. */
export function computeCommissionCents(
  subtotalCents: number,
  rate: number
): number {
  return Math.round(subtotalCents * rate);
}
