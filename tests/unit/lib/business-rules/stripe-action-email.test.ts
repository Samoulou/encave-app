import { describe, it, expect } from 'vitest';
import {
  computeStripeDueHash,
  shouldNotifyStripeAction,
} from '@/lib/business-rules/stripe-action-email';

const NOW = new Date('2026-07-10T12:00:00Z');
const DUE = ['external_account', 'individual.verification.document'];

describe('computeStripeDueHash', () => {
  it('is order-insensitive', () => {
    expect(computeStripeDueHash(['a', 'b'])).toBe(
      computeStripeDueHash(['b', 'a'])
    );
  });

  it('changes when the list changes', () => {
    expect(computeStripeDueHash(['a'])).not.toBe(computeStripeDueHash(['b']));
  });
});

describe('shouldNotifyStripeAction', () => {
  it('never notifies when nothing is due', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: [],
        storedHash: null,
        lastEmailAt: null,
        now: NOW,
      })
    ).toBe(false);
  });

  it('notifies on a new requirements list (hash mismatch)', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: DUE,
        storedHash: computeStripeDueHash(['external_account']),
        lastEmailAt: NOW, // just emailed — irrelevant, the LIST changed
        now: NOW,
      })
    ).toBe(true);
  });

  it('notifies when nothing was ever stored', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: DUE,
        storedHash: null,
        lastEmailAt: null,
        now: NOW,
      })
    ).toBe(true);
  });

  it('skips an identical list emailed less than 7 days ago (anti-spam)', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: DUE,
        storedHash: computeStripeDueHash(DUE),
        lastEmailAt: new Date('2026-07-04T12:00:01Z'), // 6d 23h 59m ago
        now: NOW,
      })
    ).toBe(false);
  });

  it('skips even when Stripe reorders the same list', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: [...DUE].reverse(),
        storedHash: computeStripeDueHash(DUE),
        lastEmailAt: NOW,
        now: NOW,
      })
    ).toBe(false);
  });

  it('re-reminds an identical unresolved list after 7 days', () => {
    expect(
      shouldNotifyStripeAction({
        currentlyDue: DUE,
        storedHash: computeStripeDueHash(DUE),
        lastEmailAt: new Date('2026-07-03T12:00:00Z'), // exactly 7 days
        now: NOW,
      })
    ).toBe(true);
  });
});
