import { describe, it, expect } from 'vitest';
import {
  HOLD_WARNING_THRESHOLD_MS,
  formatHoldCountdown,
  getHoldPhase,
  getHoldRemainingMs,
} from '@/lib/utils/hold-countdown';

describe('hold-countdown helpers (P-04 / L-050)', () => {
  describe('getHoldRemainingMs', () => {
    it('returns the positive difference between expiry and now', () => {
      const now = Date.parse('2026-07-09T12:00:00.000Z');
      expect(getHoldRemainingMs('2026-07-09T12:10:00.000Z', now)).toBe(
        10 * 60 * 1000
      );
    });

    it('clamps at 0 once the hold has expired', () => {
      const now = Date.parse('2026-07-09T12:00:00.000Z');
      expect(getHoldRemainingMs('2026-07-09T11:59:59.000Z', now)).toBe(0);
    });

    it('treats an unparseable timestamp as already expired', () => {
      expect(getHoldRemainingMs('not-a-date', Date.now())).toBe(0);
    });
  });

  describe('getHoldPhase', () => {
    it('is neutral above the 2-minute warning threshold', () => {
      expect(getHoldPhase(HOLD_WARNING_THRESHOLD_MS + 1)).toBe('neutral');
      expect(getHoldPhase(10 * 60 * 1000)).toBe('neutral');
    });

    it('is warning at and below 2 minutes remaining', () => {
      expect(getHoldPhase(HOLD_WARNING_THRESHOLD_MS)).toBe('warning');
      expect(getHoldPhase(1000)).toBe('warning');
    });

    it('is expired at exactly 0 (and below)', () => {
      expect(getHoldPhase(0)).toBe('expired');
      expect(getHoldPhase(-5000)).toBe('expired');
    });
  });

  describe('formatHoldCountdown', () => {
    it('formats full minutes as M:SS', () => {
      expect(formatHoldCountdown(10 * 60 * 1000)).toBe('10:00');
      expect(formatHoldCountdown(2 * 60 * 1000)).toBe('2:00');
    });

    it('pads seconds to two digits', () => {
      expect(formatHoldCountdown(61 * 1000)).toBe('1:01');
      expect(formatHoldCountdown(9 * 1000)).toBe('0:09');
    });

    it('ceils partial seconds so 0:00 only shows when truly expired', () => {
      expect(formatHoldCountdown(9200)).toBe('0:10');
      expect(formatHoldCountdown(1)).toBe('0:01');
    });

    it('never goes below 0:00', () => {
      expect(formatHoldCountdown(0)).toBe('0:00');
      expect(formatHoldCountdown(-1000)).toBe('0:00');
    });
  });
});
