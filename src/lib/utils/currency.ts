/**
 * Format amount in cents as CHF currency
 */
export function formatCHF(amountInCents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amountInCents / 100);
}

/**
 * Format amount in cents as compact CHF (CHF X.XX)
 */
export function formatCHFCompact(amountInCents: number): string {
  return `CHF ${(amountInCents / 100).toFixed(2)}`;
}

/**
 * Format amount in cents as plain number (X.XX)
 */
export function formatCHFAmount(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2);
}
