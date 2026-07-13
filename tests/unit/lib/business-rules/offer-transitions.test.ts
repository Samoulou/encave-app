import { describe, expect, it } from 'vitest';
import type { RequestOfferStatus } from '@prisma/client';
import {
  canTransitionRequestOffer,
  assertRequestOfferTransition,
} from '@/lib/business-rules/offer-transitions';

const ALL: RequestOfferStatus[] = ['SENT', 'PAID', 'EXPIRED', 'WITHDRAWN'];
const ALLOWED: [RequestOfferStatus, RequestOfferStatus][] = [
  ['SENT', 'PAID'],
  ['SENT', 'EXPIRED'],
  ['SENT', 'WITHDRAWN'],
];

describe('offer-transitions (RequestOfferStatus state machine)', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransitionRequestOffer(from, to)).toBe(true);
    expect(() => assertRequestOfferTransition(from, to)).not.toThrow();
  });

  const FORBIDDEN: [RequestOfferStatus, RequestOfferStatus][] = [];
  for (const from of ALL) {
    for (const to of ALL) {
      if (!ALLOWED.some(([f, t]) => f === from && t === to)) {
        FORBIDDEN.push([from, to]);
      }
    }
  }

  it.each(FORBIDDEN)('forbids %s -> %s', (from, to) => {
    expect(canTransitionRequestOffer(from, to)).toBe(false);
    expect(() => assertRequestOfferTransition(from, to)).toThrow(
      /INVALID_REQUEST_OFFER_TRANSITION/
    );
  });

  it('has no self-transitions', () => {
    for (const s of ALL) expect(canTransitionRequestOffer(s, s)).toBe(false);
  });

  it('terminal states (PAID/EXPIRED/WITHDRAWN) have no exits', () => {
    const terminal: RequestOfferStatus[] = ['PAID', 'EXPIRED', 'WITHDRAWN'];
    for (const from of terminal) {
      for (const to of ALL) {
        expect(canTransitionRequestOffer(from, to)).toBe(false);
      }
    }
  });
});
