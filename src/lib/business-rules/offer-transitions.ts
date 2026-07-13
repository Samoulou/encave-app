import type { RequestOfferStatus } from '@prisma/client';

/**
 * Sur-mesure offer state machine (US-240, P-10). Twin of
 * `request-transitions.ts` (which covers the Request); P-02 shipped the
 * Request machine but not this one.
 *
 *   SENT ──> PAID       (terminal — client paid, booking confirmed)
 *      │───> EXPIRED    (validity elapsed, auto-closed by cron)
 *      └───> WITHDRAWN   (winemaker cancelled the offer)
 *
 * Server actions (P-10) MUST validate every status change through
 * `canTransitionRequestOffer` — never write `status` directly.
 */
const ALLOWED_TRANSITIONS: Record<
  RequestOfferStatus,
  readonly RequestOfferStatus[]
> = {
  SENT: ['PAID', 'EXPIRED', 'WITHDRAWN'],
  PAID: [],
  EXPIRED: [],
  WITHDRAWN: [],
};

export function canTransitionRequestOffer(
  from: RequestOfferStatus,
  to: RequestOfferStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertRequestOfferTransition(
  from: RequestOfferStatus,
  to: RequestOfferStatus
): void {
  if (!canTransitionRequestOffer(from, to)) {
    throw new Error(`INVALID_REQUEST_OFFER_TRANSITION:${from}->${to}`);
  }
}
