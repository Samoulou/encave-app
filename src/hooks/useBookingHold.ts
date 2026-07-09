'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBookingHold } from '@/server/actions/checkout';
import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';

/** Loose cuid shape — enough to skip garbage without a server round-trip. */
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;

interface StoredHold {
  holdId: string;
  holdToken: string;
  expiresAt: string;
}

interface ContinueSelection {
  date: string;
  time: string;
  guests: number;
}

function holdStorageKey(experienceId: string): string {
  return `encave.hold.${experienceId}`;
}

/**
 * Last hold created for this experience in this tab, or null. Any storage
 * failure (Safari private mode, corrupted JSON, malformed ids) reads as
 * "no previous hold" — the server simply skips the release step.
 */
function readStoredHold(experienceId: string): StoredHold | null {
  try {
    const raw = sessionStorage.getItem(holdStorageKey(experienceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredHold>;
    if (
      typeof parsed.holdId !== 'string' ||
      !CUID_PATTERN.test(parsed.holdId) ||
      typeof parsed.holdToken !== 'string' ||
      parsed.holdToken.length < 16 ||
      typeof parsed.expiresAt !== 'string'
    ) {
      return null;
    }
    return {
      holdId: parsed.holdId,
      holdToken: parsed.holdToken,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function writeStoredHold(experienceId: string, hold: StoredHold): void {
  try {
    sessionStorage.setItem(holdStorageKey(experienceId), JSON.stringify(hold));
  } catch {
    // Quota / private mode — the next hold just won't release this one.
  }
}

/**
 * Shared « Continuer » handler for the booking widgets (P-04 review):
 * creates the 10-min hold, then navigates to the checkout with the hold
 * trio in the URL.
 *
 * - Double-click safe: a synchronous ref guards the handler — React 18's
 *   `startTransition(async …)` does NOT keep `isPending` true across the
 *   await, which is exactly the double-hold bug this replaces.
 * - Self-block safe: the previous unclaimed hold for this experience is
 *   memorized in sessionStorage and handed back to `createBookingHold`,
 *   which releases it in the same transaction.
 * - Only a genuine NO_CAPACITY blocks the user — any other failure (rate
 *   limit, server, network) degrades softly to the hold-at-submit flow.
 */
export function useBookingHold(experienceId: string, experienceSlug: string) {
  const t = useTranslations('booking');
  const { navigate, isPending: isNavigating } = useNavigateWithTransition();

  const [isCreatingHold, setIsCreatingHold] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  // Synchronous re-entry guard — state alone is async and lets a fast
  // second click through before the first render commits.
  const busyRef = useRef(false);

  const clearHoldError = useCallback(() => {
    setHoldError(null);
  }, []);

  const continueToCheckout = useCallback(
    async ({ date, time, guests }: ContinueSelection) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setIsCreatingHold(true);
      setHoldError(null);

      const params = new URLSearchParams({
        date,
        time,
        guests: guests.toString(),
      });

      // Reset the guard ONLY on the stay-on-page path — after navigate we
      // are leaving, and re-enabling the button would invite a second hold.
      let navigating = false;

      try {
        const previousHold = readStoredHold(experienceId);
        const result = await createBookingHold({
          experienceId,
          date,
          timeSlot: time,
          guestCount: guests,
          previousHoldId: previousHold?.holdId,
          previousHoldToken: previousHold?.holdToken,
        });

        if (result.success) {
          writeStoredHold(experienceId, result.data);
          params.set('holdId', result.data.holdId);
          params.set('holdToken', result.data.holdToken);
          params.set('holdExpiresAt', result.data.expiresAt);
        } else if (result.error.code === 'NO_CAPACITY') {
          setHoldError(t('holdSlotTaken'));
          return;
        }
        // Any other failure: soft degradation, checkout without a hold.

        navigating = true;
        navigate(
          `/experiences/${experienceSlug}/checkout?${params.toString()}`
        );
      } catch {
        // Soft degradation — continue to checkout without a hold.
        navigating = true;
        navigate(
          `/experiences/${experienceSlug}/checkout?${params.toString()}`
        );
      } finally {
        if (!navigating) {
          busyRef.current = false;
          setIsCreatingHold(false);
        }
      }
    },
    [experienceId, experienceSlug, navigate, t]
  );

  return {
    continueToCheckout,
    isSubmitting: isCreatingHold || isNavigating,
    holdError,
    clearHoldError,
  };
}
