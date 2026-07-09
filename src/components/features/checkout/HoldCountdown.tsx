'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Timer } from 'lucide-react';
import {
  formatHoldCountdown,
  getHoldPhase,
  getHoldRemainingMs,
  type HoldPhase,
} from '@/lib/utils/hold-countdown';
import { cn } from '@/lib/utils';

interface HoldCountdownProps {
  /** ISO expiry of the hold, as returned by `createBookingHold`. */
  expiresAt: string;
  /**
   * Server clock (`Date.now()` at server render). The countdown ticks on
   * `Date.now() + (serverNowMs - clientNow)` so a wrong client clock still
   * shows the true remaining time against the server-side expiry.
   */
  serverNowMs: number;
  /** Fired exactly once when the countdown reaches zero. */
  onExpire: () => void;
}

/**
 * Discreet "slot held for M:SS" pill on the checkout page (P-04 / L-050).
 * Neutral above 2 minutes, warning-colored below, and hands control back
 * to the parent (redirect to /reservation/erreur) at zero.
 *
 * A11y: the ticking text is aria-hidden — a live region updating every
 * second would be announced 600 times. A separate sr-only live region
 * announces only the phase transitions (under 2 min, expired).
 */
export function HoldCountdown({
  expiresAt,
  serverNowMs,
  onExpire,
}: HoldCountdownProps) {
  const t = useTranslations('checkout');
  // null until mounted — the first tick happens client-side only, so the
  // SSR HTML never disagrees with the hydrated countdown text.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const hasExpiredRef = useRef(false);
  // Client-vs-server clock offset, captured once at mount. Positive when
  // the client clock runs behind the server, negative when ahead.
  const offsetRef = useRef<number | null>(null);

  useEffect(() => {
    if (offsetRef.current === null) {
      offsetRef.current = serverNowMs - Date.now();
    }
    const offset = offsetRef.current;
    const tick = () => {
      setRemainingMs(getHoldRemainingMs(expiresAt, Date.now() + offset));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, serverNowMs]);

  const phase = remainingMs === null ? null : getHoldPhase(remainingMs);

  useEffect(() => {
    if (phase === 'expired' && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire();
    }
  }, [phase, onExpire]);

  // Screen-reader announcement — updated ONLY on phase transitions so the
  // live region speaks twice at most, never on every tick.
  const [announcement, setAnnouncement] = useState('');
  const announcedPhaseRef = useRef<HoldPhase | null>(null);

  useEffect(() => {
    if (phase === null || phase === announcedPhaseRef.current) return;
    announcedPhaseRef.current = phase;
    if (phase === 'warning') {
      setAnnouncement(
        t('hold.remainingUrgent', {
          time: formatHoldCountdown(remainingMs ?? 0),
        })
      );
    } else if (phase === 'expired') {
      setAnnouncement(t('hold.expired'));
    }
  }, [phase, remainingMs, t]);

  if (remainingMs === null || phase === null) {
    return null;
  }

  const time = formatHoldCountdown(remainingMs);

  return (
    <>
      <div
        data-testid="hold-countdown"
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
          phase === 'neutral' && 'border-stone-200 bg-white text-ink-700',
          phase === 'warning' && 'border-amber-300 bg-amber-50 text-amber-800',
          phase === 'expired' && 'border-red-200 bg-red-50 text-red-700'
        )}
      >
        <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span aria-hidden="true">
          {phase === 'expired'
            ? t('hold.expired')
            : phase === 'warning'
              ? t('hold.remainingUrgent', { time })
              : t('hold.remaining', { time })}
        </span>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
