'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Lock,
  CreditCard,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ContactDetailsSection } from '@/components/features/checkout/ContactDetailsSection';
import { HoldCountdown } from '@/components/features/checkout/HoldCountdown';
import { OrderSummary } from '@/components/features/checkout/OrderSummary';
import { MobileOrderSummary } from '@/components/features/checkout/MobileOrderSummary';
import { GiftCodeField } from '@/components/features/checkout/GiftCodeField';
import { TrustBadges } from '@/components/features/checkout/TrustBadges';
import {
  checkAvailability,
  type ExperienceForBooking,
} from '@/server/actions/booking';
import { createBookingAndCheckout } from '@/server/actions/checkout';
import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';
import { formatCHF } from '@/lib/utils/currency';
import { capturePostHog } from '@/lib/posthog-client';

// BUG-013: Periodic recheck interval (60 seconds)
const AVAILABILITY_RECHECK_INTERVAL_MS = 60000;

// Phone validation - accepts Swiss and international formats
const phoneRegex =
  /^(\+41|0041|0)?[\s-]?[1-9](?:[\s-]?\d){8}$|^\+?[1-9](?:[\s-]?\d){6,14}$/;

const checkoutFormSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  ageConfirmed: z
    .boolean()
    .refine((value) => value, 'Merci de confirmer votre age.'),
});

type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

interface CheckoutClientProps {
  experience: ExperienceForBooking;
  slug: string;
  date: string;
  time: string;
  guestCount: number;
  /** Client booking fee per ticket in cents — 0 when BOOKING_FEE is OFF. */
  serviceFeeCentsPerGuest: number;
  /**
   * No-show fee per guest in cents (P-08) — > 0 only for an ON_SITE offer with
   * the winery opted in and the flag ON. Drives the card-imprint acceptance.
   */
  noShowFeeCentsPerGuest: number;
  /** Hold created at « Continuer » (L-050) — null = degraded, no-hold flow. */
  holdId: string | null;
  /** Ownership secret of the hold — required to claim it at submit. */
  holdToken: string | null;
  /** ISO expiry of the hold — drives the countdown. Null with holdId null. */
  holdExpiresAt: string | null;
  /** Server clock at render — anchors the countdown against client skew. */
  serverNowMs: number;
  /** GIFT_CARDS flag — gates the gift-code field (P-09). */
  giftEnabled: boolean;
}

/**
 * Client component for checkout form.
 * Receives pre-fetched experience data from server component to eliminate waterfall.
 */
export function CheckoutClient({
  experience,
  slug,
  date,
  time,
  guestCount,
  serviceFeeCentsPerGuest,
  noShowFeeCentsPerGuest,
  holdId,
  holdToken,
  holdExpiresAt,
  serverNowMs,
  giftEnabled,
}: CheckoutClientProps) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'fr' | 'de' | 'en';
  const tBooking = useTranslations('booking');
  const tErrors = useTranslations('errors');
  const { navigate } = useNavigateWithTransition();

  const [submitError, setSubmitError] = useState<string | null>(null);
  // No-show card imprint (P-08): the client must accept the fee before booking
  // an ON_SITE offer that carries no-show protection.
  const noShowApplies = noShowFeeCentsPerGuest > 0;
  const [noShowAccepted, setNoShowAccepted] = useState(false);
  const [noShowError, setNoShowError] = useState(false);
  // Gift card applied at checkout (P-09) — code + previewed covered amount.
  const [giftCode, setGiftCode] = useState('');
  const [giftAppliedCents, setGiftAppliedCents] = useState(0);
  // Once the submit started, the countdown must never yank the user away —
  // the server extends the hold to the Stripe session window, and a
  // redirect mid-flight would abandon a live payment session.
  const hasSubmittedRef = useRef(false);

  // Set Sentry booking context for all errors on this page
  useEffect(() => {
    Sentry.setContext('booking', {
      experienceId: experience.id,
      experienceTitle: experience.title,
      wineryId: experience.winery.id,
      slug,
      date,
      timeSlot: time,
      guestCount,
      totalPriceCHF: (experience.price * guestCount) / 100,
    });

    return () => {
      Sentry.setContext('booking', null);
    };
  }, [experience, slug, date, time, guestCount]);

  // BUG-003 & BUG-013: Availability state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null
  );
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  );
  const [capacityExceeded, setCapacityExceeded] = useState(false);

  // Ref for interval cleanup
  const recheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      ageConfirmed: false,
    },
  });

  // BUG-003 & BUG-013: Check availability function
  const validateAvailability = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsCheckingAvailability(true);
      }
      setAvailabilityError(null);

      try {
        const result = await checkAvailability({
          experienceId: experience.id,
          date,
          timeSlot: time,
          // Our own hold counts against capacity — exclude it, or the
          // checkout ejects itself from the seats it is holding.
          excludeBookingId: holdId ?? undefined,
        });

        if (result.success) {
          setRemainingCapacity(result.data.remainingCapacity);

          // Check if capacity is now exceeded
          if (guestCount > result.data.remainingCapacity) {
            setCapacityExceeded(true);
          } else {
            setCapacityExceeded(false);
          }

          // If no capacity at all, redirect back to experience page
          if (result.data.remainingCapacity === 0) {
            navigate(
              `/experiences/${slug}?error=no_availability&date=${date}&time=${time}`
            );
            return;
          }
        } else {
          setAvailabilityError(result.error.message);
        }
      } catch {
        setAvailabilityError(
          'Failed to verify availability. Please try again.'
        );
      } finally {
        if (showLoading) {
          setIsCheckingAvailability(false);
        }
      }
    },
    [date, time, guestCount, slug, navigate, experience.id, holdId]
  );

  // BUG-003: Validate availability on mount — SKIPPED when the client
  // holds a seat hold (P-05 review): the hold IS their guaranteed place,
  // so an occurrence closing or the remaining capacity being consumed by
  // others must neither eject them nor disable the form. The claim
  // re-validates server-side at submit anyway.
  useEffect(() => {
    if (holdId) return;
    validateAvailability();
  }, [validateAvailability, holdId]);

  // BUG-013: Periodic availability recheck — no-hold fallback path only.
  useEffect(() => {
    if (holdId) return;
    recheckIntervalRef.current = setInterval(() => {
      validateAvailability(false);
    }, AVAILABILITY_RECHECK_INTERVAL_MS);

    return () => {
      if (recheckIntervalRef.current) {
        clearInterval(recheckIntervalRef.current);
      }
    };
  }, [validateAvailability, holdId]);

  // Retry handler for availability errors
  const handleRetryAvailability = useCallback(() => {
    validateAvailability();
  }, [validateAvailability]);

  // Hold ran out (L-050/L-052): the seats are released — send the client
  // to the dedicated error page with the selection memorized for re-pick.
  // No-op once the submit started: the server extends the hold to the
  // Stripe session window, the local countdown is stale by then.
  const handleHoldExpired = useCallback(() => {
    if (hasSubmittedRef.current) return;
    const params = new URLSearchParams({
      cause: 'hold-expired',
      slug,
      date,
      time,
      guests: guestCount.toString(),
    });
    navigate(`/reservation/erreur?${params.toString()}`);
  }, [navigate, slug, date, time, guestCount]);

  const onSubmit = async (data: CheckoutFormData) => {
    // Card-imprint acceptance is mandatory for an ON_SITE no-show offer.
    if (noShowApplies && !noShowAccepted) {
      setNoShowError(true);
      return;
    }
    hasSubmittedRef.current = true;
    setSubmitError(null);

    capturePostHog('booking_payment_initiated', {
      experience_id: experience.id,
      experience_slug: slug,
      winery_id: experience.winery.id,
      date,
      time_slot: time,
      guest_count: guestCount,
      total_price_chf: (experience.price * guestCount) / 100,
    });

    try {
      const result = await createBookingAndCheckout({
        experienceId: experience.id,
        wineryId: experience.winery.id,
        date,
        timeSlot: time,
        guestCount,
        visitorName: `${data.firstName} ${data.lastName}`,
        visitorEmail: data.email,
        visitorPhone: data.phone.replace(/\s/g, ''),
        ageConfirmed: true,
        locale,
        displayedServiceFeeCentsPerGuest: serviceFeeCentsPerGuest,
        // No-show fee the client accepted (P-08) — the server re-checks it
        // against the winery's current setting (NO_SHOW_CHANGED guard).
        ...(noShowApplies
          ? { displayedNoShowFeeCents: noShowFeeCentsPerGuest }
          : {}),
        // Gift card (P-09) — the server re-locks and re-checks the amount;
        // displayedGiftAppliedCents guards against a drained code.
        ...(giftEnabled && giftCode && giftAppliedCents > 0
          ? {
              giftCode,
              displayedGiftAppliedCents: giftAppliedCents,
            }
          : {}),
        // Claim the upstream hold (L-050); undefined = fresh create.
        // The token proves ownership — the server refuses a bare id.
        holdId: holdId ?? undefined,
        holdToken: holdToken ?? undefined,
      });

      if (result.success) {
        window.location.assign(result.data.checkoutUrl);
      } else {
        hasSubmittedRef.current = false;
        setSubmitError(result.error.message);
      }
    } catch {
      hasSubmittedRef.current = false;
      setSubmitError(tErrors('somethingWentWrong'));
    }
  };

  // BUG-003: Form is disabled if capacity is exceeded or still checking.
  // Never with a hold — the held seats are the client's, whatever the
  // availability of the remainder (defense in depth: with a hold the
  // checks above don't even run).
  const isFormDisabled =
    !holdId && (capacityExceeded || isCheckingAvailability);
  const totalPrice = experience.price * guestCount;
  const serviceFee = serviceFeeCentsPerGuest * guestCount;
  const totalWithFees = totalPrice + serviceFee;

  return (
    <div className="w-full bg-cream-50 px-4 py-10 md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page Heading */}
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
              Paiement sécurisé
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.02em] text-ink-900 md:text-5xl">
              {t('pageTitle')}
            </h1>
            <p className="mt-2 max-w-2xl text-[#915564]">{t('pageSubtitle')}</p>
            {holdId && holdExpiresAt && (
              <div className="mt-4">
                <HoldCountdown
                  expiresAt={holdExpiresAt}
                  serverNowMs={serverNowMs}
                  onExpire={handleHoldExpired}
                />
              </div>
            )}
          </div>
          <div className="hidden rounded-[16px] border border-burgundy-100 bg-white p-4 shadow-audit-card lg:block">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-burgundy-50 text-burgundy-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">
                  Stripe Checkout
                </p>
                <p className="text-xs text-ink-500">
                  Paiement carte et wallet, redirection sécurisée.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alerts */}
        {availabilityError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{availabilityError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAvailability}
                disabled={isCheckingAvailability}
                className="ml-2"
              >
                {isCheckingAvailability ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Retry
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {capacityExceeded && remainingCapacity !== null && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('capacityExceeded')}</AlertTitle>
            <AlertDescription>
              {t('capacityExceededMessage', {
                requested: guestCount,
                available: remainingCapacity,
              })}
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/experiences/${slug}?date=${date}&time=${time}&guests=${remainingCapacity}`}
                  >
                    {t('adjustGuestCount')}
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isCheckingAvailability && remainingCapacity === null && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <AlertDescription className="text-foreground">
              {t('verifyingAvailability')}
            </AlertDescription>
          </Alert>
        )}

        {/* Mobile Order Summary (Collapsible) */}
        <div className="mb-6">
          <MobileOrderSummary
            experienceTitle={experience.title}
            experienceImage={experience.coverPhoto}
            location={experience.winery.commune || 'Valais'}
            date={date}
            time={time}
            duration={
              experience.duration ? experience.duration / 60 : undefined
            }
            guestCount={guestCount}
            pricePerPerson={experience.price}
            serviceFee={serviceFee}
            giftAppliedCents={giftAppliedCents}
            cancellationPolicy={experience.winery.cancellationPolicy}
          />
          {giftEnabled && (
            <div className="mt-3 rounded-xl border border-border bg-white p-4 shadow-sm lg:hidden">
              <GiftCodeField
                experienceId={experience.id}
                guestCount={guestCount}
                appliedCents={giftAppliedCents}
                onApplied={(code, applied) => {
                  setGiftCode(code);
                  setGiftAppliedCents(applied);
                }}
                onCleared={() => {
                  setGiftCode('');
                  setGiftAppliedCents(0);
                }}
              />
            </div>
          )}
        </div>

        {/* Main Grid Layout */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          data-testid="checkout-form"
          noValidate
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
            {/* Left Column: Contact Form & Payment Button */}
            <div className="flex flex-col gap-6">
              <div className="rounded-[18px] border border-stone-200 bg-white p-5 shadow-audit-card">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-burgundy-700">
                      Étape 1
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-semibold">
                      Vos coordonnées
                    </h2>
                  </div>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    <Check className="mr-1 inline h-3 w-3" />
                    Réservation tenue
                  </span>
                </div>
                {/* Contact Details Section */}
                <fieldset disabled={isFormDisabled || isSubmitting}>
                  <ContactDetailsSection
                    register={register}
                    errors={errors}
                    isSubmitting={isSubmitting || isFormDisabled}
                  />
                </fieldset>
              </div>

              {/* Payment Section - Simplified for Stripe redirect */}
              <section className="rounded-[18px] border border-stone-200 bg-white p-6 shadow-audit-card md:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-burgundy-700">
                      Étape 2
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-semibold">
                      Paiement express
                    </h2>
                  </div>
                  <CreditCard className="h-6 w-6 text-burgundy-700" />
                </div>
                {/* Trust Badge */}
                <div className="mb-6 flex items-center justify-center gap-2 rounded-xl border border-burgundy-100 bg-burgundy-50 p-3">
                  <Lock
                    className="h-4 w-4 text-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t('securePaymentStripe')}
                  </span>
                </div>

                {/* Submit Error */}
                {submitError && (
                  <div className="mb-4 rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                {/* No-show card imprint acceptance (P-08 / US-220) */}
                {noShowApplies && (
                  <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-amber-900">
                      {t('noShow.title', {
                        amount: formatCHF(noShowFeeCentsPerGuest),
                      })}
                    </p>
                    <p className="mb-3 text-sm text-amber-800">
                      {t('noShow.explainer')}
                    </p>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="noShowAccepted"
                        aria-required="true"
                        aria-describedby="no-show-error"
                        checked={noShowAccepted}
                        onCheckedChange={(checked) => {
                          setNoShowAccepted(checked === true);
                          if (checked === true) setNoShowError(false);
                        }}
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="noShowAccepted"
                          className="text-sm font-semibold text-amber-900"
                        >
                          {t('noShow.checkboxLabel', {
                            amount: formatCHF(noShowFeeCentsPerGuest),
                          })}
                        </Label>
                        {noShowError && (
                          <p
                            id="no-show-error"
                            className="text-sm font-medium text-red-700"
                          >
                            {t('noShow.required')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-6 rounded-lg border border-border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Controller
                      name="ageConfirmed"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="ageConfirmed"
                          aria-required="true"
                          aria-describedby="age-confirmed-help age-confirmed-error"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked === true);
                          }}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      )}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="ageConfirmed"
                        className="text-sm font-semibold text-foreground"
                      >
                        {t('ageGate.checkboxLabel')}
                      </Label>
                      <p
                        id="age-confirmed-help"
                        className="text-sm text-[#915564]"
                      >
                        {t('ageGate.helper')}
                      </p>
                      {errors.ageConfirmed && (
                        <p
                          id="age-confirmed-error"
                          className="text-sm font-medium text-red-700"
                        >
                          {t('ageGate.errors.required')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA Button - Redirects to Stripe */}
                <Button
                  type="submit"
                  disabled={isSubmitting || isFormDisabled}
                  className="group h-14 w-full rounded-lg bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-[hsl(var(--primary-hover))]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('processing')}
                    </>
                  ) : (
                    <>
                      <span>
                        {t('confirmAndPay', {
                          amount: formatCHF(totalWithFees),
                        })}
                      </span>
                      <svg
                        className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </>
                  )}
                </Button>

                {/* Terms Text */}
                <p className="mt-4 text-center text-xs text-[#915564]">
                  {t('termsAgreement')}
                </p>
              </section>
            </div>

            {/* Right Column: Summary (Sticky) - Desktop Only */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <OrderSummary
                  experienceTitle={experience.title}
                  experienceImage={experience.coverPhoto}
                  location={experience.winery.commune || 'Valais'}
                  date={date}
                  time={time}
                  duration={
                    experience.duration ? experience.duration / 60 : undefined
                  }
                  guestCount={guestCount}
                  pricePerPerson={experience.price}
                  serviceFee={serviceFee}
                  giftAppliedCents={giftAppliedCents}
                  cancellationPolicy={experience.winery.cancellationPolicy}
                />

                {giftEnabled && (
                  <div className="mt-4 rounded-xl border border-border bg-white p-4 shadow-sm">
                    <GiftCodeField
                      experienceId={experience.id}
                      guestCount={guestCount}
                      appliedCents={giftAppliedCents}
                      onApplied={(code, applied) => {
                        setGiftCode(code);
                        setGiftAppliedCents(applied);
                      }}
                      onCleared={() => {
                        setGiftCode('');
                        setGiftAppliedCents(0);
                      }}
                    />
                  </div>
                )}

                {/* Capacity Status Indicator */}
                {remainingCapacity !== null && !capacityExceeded && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {tBooking('remainingCapacity', {
                          count: remainingCapacity,
                        })}
                      </span>
                    </div>
                  </div>
                )}

                <TrustBadges />
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
