/**
 * Pure helpers for the checkout hold countdown (P-04 / L-050).
 * Kept free of React/DOM so the timing logic is unit-testable.
 */

/** Below this remaining time the countdown switches to the warning state. */
export const HOLD_WARNING_THRESHOLD_MS = 2 * 60 * 1000;

export type HoldPhase = 'neutral' | 'warning' | 'expired';

/**
 * Remaining hold time in milliseconds, clamped at 0.
 * An unparseable ISO timestamp counts as already expired — the checkout
 * then degrades to the no-hold flow instead of showing a bogus timer.
 */
export function getHoldRemainingMs(
  expiresAtIso: string,
  nowMs: number
): number {
  const expiresAtMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiresAtMs)) {
    return 0;
  }
  return Math.max(0, expiresAtMs - nowMs);
}

export function getHoldPhase(remainingMs: number): HoldPhase {
  if (remainingMs <= 0) {
    return 'expired';
  }
  if (remainingMs <= HOLD_WARNING_THRESHOLD_MS) {
    return 'warning';
  }
  return 'neutral';
}

/**
 * "M:SS" display — ceiled so the timer only shows 0:00 when the hold is
 * genuinely gone (9.2s remaining reads 0:10, never a premature 0:09).
 */
export function formatHoldCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
