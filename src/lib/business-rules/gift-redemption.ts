/**
 * How much of a gift card balance is applied to an amount due (P-09).
 *
 * Pure module — shared by the authoritative redemption (FOR UPDATE lock)
 * and the read-only checkout preview, so the amount the client accepts is
 * exactly the amount debited (GIFT_CHANGED guard).
 */

/**
 * Stripe refuses a CHF charge under 0.50. A gift that leaves a card
 * remainder of 1–49 centimes would mint a Checkout Session Stripe rejects:
 * the redemption stayed reserved on a booking that could never be paid.
 */
export const MIN_CARD_CHARGE_CENTS = 50;

/**
 * Applied gift amount for `dueCents` given `balanceCents`.
 *
 * Rule: apply as much as possible, EXCEPT when that would leave a card
 * remainder strictly between 0 and the Stripe minimum — then the redemption
 * is capped so the card part is exactly the minimum (0.50 CHF) and the few
 * centimes not applied STAY on the gift card.
 *
 * Why capping rather than waiving the remainder: the ledger stays exact
 * without any new column. Every centime is either debited from the card
 * (REDEMPTION), still on its balance, or charged to the bank card — the
 * platform never absorbs an untracked amount, and the booking's
 * `totalPrice + serviceFeeCents − giftAppliedCents` is still exactly what
 * Stripe charged (amount cross-check at confirmation).
 */
export function computeGiftApplication(
  balanceCents: number,
  dueCents: number
): { appliedCents: number; cardCents: number } {
  if (balanceCents <= 0 || dueCents <= 0) {
    return { appliedCents: 0, cardCents: Math.max(0, dueCents) };
  }
  let appliedCents = Math.min(balanceCents, dueCents);
  const remainder = dueCents - appliedCents;
  if (remainder > 0 && remainder < MIN_CARD_CHARGE_CENTS) {
    // Leave exactly the minimum on the card — unless the whole due is under
    // the minimum (nothing chargeable either way: keep the full application).
    const capped = dueCents - MIN_CARD_CHARGE_CENTS;
    if (capped > 0) appliedCents = capped;
  }
  return { appliedCents, cardCents: dueCents - appliedCents };
}
