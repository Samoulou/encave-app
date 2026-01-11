export type PaymentStatusType = 'not_connected' | 'pending' | 'ready';

/**
 * Helper to determine payment status from winery data
 */
export function getPaymentStatusType(winery: {
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeDetailsSubmitted: boolean;
}): PaymentStatusType {
  if (!winery.stripeAccountId) {
    return 'not_connected';
  }
  if (winery.stripeOnboardingComplete) {
    return 'ready';
  }
  if (winery.stripeDetailsSubmitted) {
    return 'pending';
  }
  return 'not_connected';
}
