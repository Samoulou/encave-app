import { describe, it, expect } from 'vitest';
import {
  canTransitionRequest,
  assertRequestTransition,
} from '@/lib/business-rules/request-transitions';
import type { RequestStatus } from '@prisma/client';

const ALL: RequestStatus[] = [
  'PENDING',
  'OFFERED',
  'PAID',
  'EXPIRED',
  'CLOSED',
];

describe('request-transitions', () => {
  it.each([
    ['PENDING', 'OFFERED'],
    ['PENDING', 'CLOSED'],
    ['OFFERED', 'PAID'],
    ['OFFERED', 'EXPIRED'],
    ['OFFERED', 'CLOSED'],
    ['EXPIRED', 'CLOSED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransitionRequest(from, to)).toBe(true);
  });

  it.each([
    ['PENDING', 'PAID'], // paying without an offer is impossible
    ['PENDING', 'EXPIRED'],
    ['PAID', 'CLOSED'], // PAID is terminal
    ['PAID', 'OFFERED'],
    ['CLOSED', 'OFFERED'], // CLOSED is terminal
    ['CLOSED', 'PENDING'],
    ['EXPIRED', 'PAID'], // an expired offer can never be paid
    ['EXPIRED', 'OFFERED'],
    ['OFFERED', 'PENDING'], // no backward transitions
  ] as const)('forbids %s -> %s', (from, to) => {
    expect(canTransitionRequest(from, to)).toBe(false);
    expect(() => assertRequestTransition(from, to)).toThrow(
      `INVALID_REQUEST_TRANSITION:${from}->${to}`
    );
  });

  it('never allows a self-transition or leaving a terminal state', () => {
    for (const s of ALL) {
      expect(canTransitionRequest(s, s)).toBe(false);
    }
    for (const to of ALL) {
      expect(canTransitionRequest('PAID', to)).toBe(false);
      expect(canTransitionRequest('CLOSED', to)).toBe(false);
    }
  });
});
