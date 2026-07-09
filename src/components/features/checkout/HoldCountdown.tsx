'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Timer } from 'lucide-react';
import {
  formatHoldCountdown,
  getHoldPhase,
  getHoldRemainingMs,
} from '@/lib/utils/hold-countdown';
import { cn } from '@/lib/utils';

interface HoldCountdownProps {
  /** ISO expiry of the hold, as returned by `createBookingHold`. */
  expiresAt: string;
  /** Fired exactly once when the countdown reaches zero. */
  onExpire: () => void;
}

/**
 * Discreet "slot held for M:SS" pill on the checkout page (P-04 / L-050).
 * Neutral above 2 minutes, warning-colored below, and hands control back
 * to the parent (redirect to /reservation/erreur) at zero.
 */
export function HoldCountdown({ expiresAt, onExpire }: HoldCountdownProps) {
  const t = useTranslations('checkout');
  // null until mounted — the first tick happens client-side only, so the
  // SSR HTML never disagrees with the hydrated countdown text.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      setRemainingMs(getHoldRemainingMs(expiresAt, Date.now()));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const phase = remainingMs === null ? null : getHoldPhase(remainingMs);

  useEffect(() => {
    if (phase === 'expired' && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire();
    }
  }, [phase, onExpire]);

  if (remainingMs === null || phase === null) {
    return null;
  }

  const time = formatHoldCountdown(remainingMs);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="hold-countdown"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        phase === 'neutral' && 'border-stone-200 bg-white text-ink-700',
        phase === 'warning' && 'border-amber-300 bg-amber-50 text-amber-800',
        phase === 'expired' && 'border-red-200 bg-red-50 text-red-700'
      )}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {phase === 'expired'
          ? t('hold.expired')
          : phase === 'warning'
            ? t('hold.remainingUrgent', { time })
            : t('hold.remaining', { time })}
      </span>
    </div>
  );
}
