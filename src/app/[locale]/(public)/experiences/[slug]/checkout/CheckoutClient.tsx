'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import { Loader2, AlertCircle, RefreshCw, Users, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ContactDetailsSection } from '@/components/features/checkout/ContactDetailsSection';
import { OrderSummary } from '@/components/features/checkout/OrderSummary';
import { MobileOrderSummary } from '@/components/features/checkout/MobileOrderSummary';
import { TrustBadges } from '@/components/features/checkout/TrustBadges';
import {
  checkAvailability,
  type ExperienceForBooking,
} from '@/server/actions/booking';
import { createBookingAndCheckout } from '@/server/actions/checkout';
import { formatCHF } from '@/lib/utils/currency';

// BUG-013: Periodic recheck interval (60 seconds)
const AVAILABILITY_RECHECK_INTERVAL_MS = 60000;

// Phone validation - accepts Swiss and international formats
const phoneRegex = /^(\+41|0041|0)?[1-9][0-9]{8}$|^\+?[1-9]\d{6,14}$/;

const checkoutFormSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
});

type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

interface CheckoutClientProps {
  experience: ExperienceForBooking;
  slug: string;
  date: string;
  time: string;
  guestCount: number;
  paymentError: string | null;
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
  paymentError,
}: CheckoutClientProps) {
  const locale = useLocale();
  const t = useTranslations('checkout');
  const tBooking = useTranslations('booking');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Track payment failure from Stripe redirect (cancelled or failed)
  useEffect(() => {
    if (paymentError) {
      posthog.capture('booking_payment_failed', {
        experience_id: experience.id,
        experience_slug: slug,
        winery_id: experience.winery.id,
        date,
        time_slot: time,
        guest_count: guestCount,
        total_price_chf: (experience.price * guestCount) / 100,
        error_type: paymentError,
      });
    }
  }, [paymentError, experience, slug, date, time, guestCount]);

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
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
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
            router.push(
              `/${locale}/experiences/${slug}?error=no_availability&date=${date}&time=${time}`
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
    [date, time, guestCount, slug, router, locale, experience.id]
  );

  // BUG-003: Validate availability on mount
  useEffect(() => {
    validateAvailability();
  }, [validateAvailability]);

  // BUG-013: Periodic availability recheck
  useEffect(() => {
    recheckIntervalRef.current = setInterval(() => {
      validateAvailability(false);
    }, AVAILABILITY_RECHECK_INTERVAL_MS);

    return () => {
      if (recheckIntervalRef.current) {
        clearInterval(recheckIntervalRef.current);
      }
    };
  }, [validateAvailability]);

  // Retry handler for availability errors
  const handleRetryAvailability = useCallback(() => {
    validateAvailability();
  }, [validateAvailability]);

  const onSubmit = async (data: CheckoutFormData) => {
    setSubmitError(null);

    posthog.capture('booking_payment_initiated', {
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
      });

      if (result.success) {
        router.push(result.data.checkoutUrl);
      } else {
        setSubmitError(result.error.message);
      }
    } catch {
      setSubmitError(tErrors('somethingWentWrong'));
    }
  };

  // BUG-003: Form is disabled if capacity is exceeded or still checking
  const isFormDisabled = capacityExceeded || isCheckingAvailability;
  const totalPrice = experience.price * guestCount;

  return (
    <div className="w-full px-4 py-10 md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Page Heading */}
        <div className="mb-8">
          <h1 className="mb-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            {t('pageTitle')}
          </h1>
          <p className="text-[#915564]">{t('pageSubtitle')}</p>
        </div>

        {/* Error Alerts */}
        {paymentError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {paymentError === 'cancelled'
                ? t('paymentCancelled')
                : t('paymentFailed')}
            </AlertDescription>
          </Alert>
        )}

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
                    href={`/${locale}/experiences/${slug}?date=${date}&time=${time}&guests=${remainingCapacity}`}
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
            serviceFee={0}
          />
        </div>

        {/* Main Grid Layout */}
        <form onSubmit={handleSubmit(onSubmit)} data-testid="checkout-form">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Contact Form & Payment Button */}
            <div className="flex flex-col gap-8 lg:col-span-7">
              {/* Contact Details Section */}
              <fieldset disabled={isFormDisabled || isSubmitting}>
                <ContactDetailsSection
                  register={register}
                  errors={errors}
                  isSubmitting={isSubmitting || isFormDisabled}
                />
              </fieldset>

              {/* Payment Section - Simplified for Stripe redirect */}
              <section className="rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
                {/* Trust Badge */}
                <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-border bg-primary-light/50 p-3">
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
                        {t('confirmAndPay', { amount: formatCHF(totalPrice) })}
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
            <aside className="hidden lg:col-span-5 lg:block">
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
                  serviceFee={0}
                />

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
