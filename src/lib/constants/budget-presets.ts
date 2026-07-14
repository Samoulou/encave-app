/**
 * Catalogue budget presets (L-115). Shared source of truth between the
 * filter chips (SearchFilters) and the active-filter pills
 * (ActiveFilterPills) so the (minPrice, maxPrice) couples can't drift.
 * Amounts are in cents (CHF), `null` means the bound is open.
 */

export type BudgetPresetKey = 'under50' | '50to100' | 'over100';

export interface BudgetPreset {
  key: BudgetPresetKey;
  minPrice: number | null;
  maxPrice: number | null;
}

export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  { key: 'under50', minPrice: null, maxPrice: 5000 },
  { key: '50to100', minPrice: 5000, maxPrice: 10000 },
  { key: 'over100', minPrice: 10001, maxPrice: null },
] as const;

/**
 * Returns the preset whose bounds match the current (minPrice, maxPrice)
 * couple exactly, or null when the range is custom / empty.
 */
export function matchBudgetPreset(
  minPrice: number | null,
  maxPrice: number | null
): BudgetPreset | null {
  return (
    BUDGET_PRESETS.find(
      (preset) => preset.minPrice === minPrice && preset.maxPrice === maxPrice
    ) ?? null
  );
}
