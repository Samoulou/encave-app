'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, AlertCircle, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookingSummary } from '@/components/features/booking';
import { CheckoutForm } from '@/components/features/checkout/CheckoutForm';
import { getExperienceForBooking, checkAvailability, type ExperienceForBooking } from '@/server/actions/booking';

// BUG-013: Periodic recheck interval (60 seconds)
const AVAILABILITY_RECHECK_INTERVAL_MS = 60000;

export default function CheckoutPage() {
  const params = useParams<{ slug: string; locale: string }>();
  const slug = params.slug;
  const t = useTranslations('checkout');
  const tBooking = useTranslations('booking');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [experience, setExperience] = useState<ExperienceForBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // BUG-003 & BUG-013: Availability state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [capacityExceeded, setCapacityExceeded] = useState(false);

  // Ref for interval cleanup
  const recheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get booking params from URL
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const guests = searchParams.get('guests');
  const paymentError = searchParams.get('error');

  // Validate required params
  const guestCount = guests ? parseInt(guests, 10) : null;
  const hasValidParams = date && time && guestCount && guestCount > 0;

  useEffect(() => {
    if (!slug) return;

    setIsLoading(true);
    getExperienceForBooking(slug).then((result) => {
      if (result.success) {
        setExperience(result.data);
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
    });
  }, [slug]);

  // BUG-003 & BUG-013: Check availability function
  const validateAvailability = useCallback(async (experienceId: string, showLoading = true) => {
    if (!date || !time || !guestCount) return;

    if (showLoading) {
      setIsCheckingAvailability(true);
    }
    setAvailabilityError(null);

    try {
      const result = await checkAvailability({
        experienceId,
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

        // If no capacity at all, redirect back to booking
        if (result.data.remainingCapacity === 0) {
          router.push(`/experiences/${slug}/book?error=no_availability&date=${date}&time=${time}`);
          return;
        }
      } else {
        setAvailabilityError(result.error.message);
      }
    } catch {
      setAvailabilityError('Failed to verify availability. Please try again.');
    } finally {
      if (showLoading) {
        setIsCheckingAvailability(false);
      }
    }
  }, [date, time, guestCount, slug, router]);

  // BUG-003: Validate availability on mount when experience is loaded
  useEffect(() => {
    if (experience && hasValidParams) {
      validateAvailability(experience.id);
    }
  }, [experience, hasValidParams, validateAvailability]);

  // BUG-013: Periodic availability recheck
  useEffect(() => {
    if (!experience || !hasValidParams) return;

    // Set up periodic recheck
    recheckIntervalRef.current = setInterval(() => {
      validateAvailability(experience.id, false); // Silent recheck
    }, AVAILABILITY_RECHECK_INTERVAL_MS);

    return () => {
      if (recheckIntervalRef.current) {
        clearInterval(recheckIntervalRef.current);
      }
    };
  }, [experience, hasValidParams, validateAvailability]);

  // Retry handler for availability errors
  const handleRetryAvailability = useCallback(() => {
    if (experience) {
      validateAvailability(experience.id);
    }
  }, [experience, validateAvailability]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" />
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || t('experienceNotFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasValidParams) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('invalidBookingParams')}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={`/experiences/${slug}/book`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToBooking')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalPrice = experience.price * guestCount;

  // BUG-003: Form is disabled if capacity is exceeded or still checking
  const isFormDisabled = capacityExceeded || isCheckingAvailability;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/experiences/${slug}/book?date=${date}&time=${time}&guests=${guests}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToBooking')}
          </Link>
        </Button>
      </div>

      {/* Payment error alert */}
      {paymentError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {paymentError === 'cancelled' ? t('paymentCancelled') : t('paymentFailed')}
          </AlertDescription>
        </Alert>
      )}

      {/* BUG-003: Availability error alert */}
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
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* BUG-003: Capacity exceeded alert */}
      {capacityExceeded && remainingCapacity !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('capacityExceeded')}</AlertTitle>
          <AlertDescription>
            {t('capacityExceededMessage', { requested: guestCount, available: remainingCapacity })}
            <div className="mt-3">
              <Button asChild variant="outline" size="sm">
                <Link href={`/experiences/${slug}/book?date=${date}&time=${time}&guests=${remainingCapacity}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('adjustGuestCount')}
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* BUG-003: Initial availability check loading state */}
      {isCheckingAvailability && remainingCapacity === null && (
        <Alert className="mb-6 border-burgundy-200 bg-burgundy-50">
          <Loader2 className="h-4 w-4 animate-spin text-burgundy-600" />
          <AlertDescription className="text-burgundy-800">
            {t('verifyingAvailability')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Checkout Form */}
        <div className="lg:col-span-2">
          <Card className={isFormDisabled ? 'opacity-60 pointer-events-none' : ''}>
            <CardHeader>
              <CardTitle>{t('guestDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckoutForm
                experienceId={experience.id}
                wineryId={experience.winery.id}
                date={date}
                time={time}
                guestCount={guestCount}
                totalPrice={totalPrice}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Booking Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <Card>
              <CardContent className="p-6">
                <BookingSummary
                  experienceTitle={experience.title}
                  wineryName={experience.winery.name}
                  date={date}
                  time={time}
                  guests={guestCount}
                  totalPrice={totalPrice}
                />
              </CardContent>
            </Card>

            {/* BUG-003: Capacity status indicator */}
            {remainingCapacity !== null && !capacityExceeded && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {tBooking('remainingCapacity', { count: remainingCapacity })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
