import type { RequestStatus } from '@prisma/client';

/**
 * Sur-mesure request state machine (US-240, P-02 foundation).
 *
 *   PENDING ──> OFFERED ──> PAID        (terminal)
 *      │            │────> EXPIRED ──> CLOSED (terminal)
 *      └───────────────────────────────> CLOSED
 *
 * The single automatic reminder happens while OFFERED (before expiry) and
 * is tracked on the offer itself (reminderSentAt), not as a status.
 * Server actions (P-10) MUST validate every status change through
 * `canTransitionRequest` — never write `status` directly.
 */
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  PENDING: ['OFFERED', 'CLOSED'],
  OFFERED: ['PAID', 'EXPIRED', 'CLOSED'],
  EXPIRED: ['CLOSED'],
  PAID: [],
  CLOSED: [],
};

export function canTransitionRequest(
  from: RequestStatus,
  to: RequestStatus
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus
): void {
  if (!canTransitionRequest(from, to)) {
    throw new Error(`INVALID_REQUEST_TRANSITION:${from}->${to}`);
  }
}
