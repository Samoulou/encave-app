'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs';
import {
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { BookingDatePicker } from './BookingDatePicker';
import { TimeSlotSelector } from './TimeSlotSelector';
import { GuestCountInput } from './GuestCountInput';
import { PriceCalculator } from './PriceCalculator';
import { BookingSummary } from './BookingSummary';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';
import type { ExperienceForBooking } from '@/server/actions/booking';

interface BookingWidgetProps {
  experience: ExperienceForBooking;
}

export function BookingWidget({ experience }: BookingWidgetProps) {
  const t = useTranslations('booking');
  const router = useRouter();

  // URL state persistence using nuqs
  const [queryState, setQueryState] = useQueryStates({
    date: parseAsString,
    time: parseAsString,
    guests: parseAsInteger.withDefault(experience.minCapacity),
  });

  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref to store the previous experience ID for detecting changes
  const prevExperienceIdRef = useRef<string>(experience.id);

  const { date, time, guests } = queryState;

  // BUG-003b FIX: Check if form is valid including remainingCapacity
  const isValid =
    date &&
    time &&
    guests >= experience.minCapacity &&
    guests <= experience.maxCapacity &&
    (remainingCapacity === null || guests <= remainingCapacity);

  // BUG-003b: Check if capacity is exceeded (for warning display)
  const capacityExceeded =
    remainingCapacity !== null && guests > remainingCapacity;

  // Available days based on availability slots
  const availableDays = new Set(
    experience.availabilitySlots.map((slot) => slot.dayOfWeek)
  );

  const handleDateChange = useCallback(
    (newDate: string | null) => {
      // BUG-030 FIX: Keep time selection - TimeSlotSelector validates if still available
      setQueryState({ date: newDate });
      setRemainingCapacity(null);
    },
    [setQueryState]
  );

  const handleTimeChange = useCallback(
    (newTime: string | null) => {
      setQueryState({ time: newTime });
    },
    [setQueryState]
  );

  const handleGuestsChange = useCallback(
    (newGuests: number) => {
      setQueryState({ guests: newGuests });
    },
    [setQueryState]
  );

  // BUG-023 FIX: Reset guests when experience changes
  useEffect(() => {
    if (prevExperienceIdRef.current !== experience.id) {
      prevExperienceIdRef.current = experience.id;
      setQueryState({ guests: experience.minCapacity, date: null, time: null });
      setRemainingCapacity(null);
    }
  }, [experience.id, experience.minCapacity, setQueryState]);

  // Callback for TimeSlotSelector to update capacity
  const handleCapacityUpdate = useCallback((capacity: number | null) => {
    setRemainingCapacity(capacity);
  }, []);

  const handleContinueToPayment = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    // Navigate to checkout page with booking details
    const params = new URLSearchParams({
      date: date!,
      time: time!,
      guests: guests.toString(),
    });
    router.push(
      `/experiences/${experience.slug}/checkout?${params.toString()}`
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Left Column - Booking Form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Experience Header */}
        <Card className="overflow-hidden" data-testid="experience-summary-card">
          <div className="flex flex-col sm:flex-row">
            <div className="relative h-48 flex-shrink-0 sm:h-auto sm:w-48">
              <Image
                src={experience.coverPhoto}
                alt={experience.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 192px"
                placeholder="blur"
                blurDataURL={IMAGE_PLACEHOLDERS.card}
              />
            </div>
            <CardContent className="flex-1 p-6">
              <h1
                className="font-display text-2xl font-bold text-slate-900"
                data-testid="experience-title"
              >
                {experience.title}
              </h1>
              <p
                className="mt-2 text-sm text-slate-600"
                data-testid="winery-name"
              >
                {experience.winery.name}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                <span
                  className="flex items-center gap-1.5"
                  data-testid="experience-duration"
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {experience.duration} min
                </span>
                <span
                  className="flex items-center gap-1.5"
                  data-testid="capacity-range"
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {/* BUG-032 FIX: Use capacityRange key to avoid "8-10 10 personnes" */}
                  {t('capacityRange', {
                    min: experience.minCapacity,
                    max: experience.maxCapacity,
                  })}
                </span>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Date Selection */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-100">
                <Calendar
                  className="h-5 w-5 text-burgundy-600"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {t('selectDate')}
                </h2>
                <p className="text-sm text-slate-500">{t('selectDateFirst')}</p>
              </div>
            </div>
            <BookingDatePicker
              selectedDate={date}
              onDateChange={handleDateChange}
              availableDays={availableDays}
            />
          </CardContent>
        </Card>

        {/* Time Selection */}
        <Card
          className={cn(!date && 'opacity-60')}
          aria-disabled={!date}
          data-testid="time-slot-section"
        >
          <fieldset disabled={!date}>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-100">
                  <Clock
                    className="h-5 w-5 text-burgundy-600"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">
                    {t('selectTime')}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {date ? t('selectTimeFirst') : t('selectDateFirst')}
                  </p>
                </div>
              </div>
              <TimeSlotSelector
                experienceId={experience.id}
                selectedDate={date}
                selectedTime={time}
                onTimeChange={handleTimeChange}
                onCapacityUpdate={handleCapacityUpdate}
              />
            </CardContent>
          </fieldset>
        </Card>

        {/* Guest Count */}
        <Card
          className={cn(!time && 'opacity-60')}
          aria-disabled={!time}
          data-testid="guest-count-section"
        >
          <fieldset disabled={!time}>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-100">
                  <Users
                    className="h-5 w-5 text-burgundy-600"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">
                    {t('selectGuests')}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {t('minGuests', { count: experience.minCapacity })} -{' '}
                    {t('maxGuests', { count: experience.maxCapacity })}
                  </p>
                </div>
              </div>

              <GuestCountInput
                value={guests}
                onChange={handleGuestsChange}
                min={experience.minCapacity}
                max={
                  remainingCapacity !== null
                    ? Math.min(experience.maxCapacity, remainingCapacity)
                    : experience.maxCapacity
                }
                isLoading={false}
                remainingCapacity={remainingCapacity}
              />
            </CardContent>
          </fieldset>
        </Card>
      </div>

      {/* Right Column - Summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-6">
          {/* Price Calculator */}
          <Card data-testid="price-section">
            <CardContent className="p-6">
              <PriceCalculator
                pricePerPerson={experience.price}
                guests={guests}
              />
            </CardContent>
          </Card>

          {/* Booking Summary */}
          {isValid && (
            <Card data-testid="booking-summary">
              <CardContent className="p-6">
                <BookingSummary
                  experienceTitle={experience.title}
                  wineryName={experience.winery.name}
                  date={date!}
                  time={time!}
                  guests={guests}
                  totalPrice={experience.price * guests}
                />
              </CardContent>
            </Card>
          )}

          {/* BUG-003b: Capacity Exceeded Warning */}
          {capacityExceeded && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                {t('capacityExceeded', { remaining: remainingCapacity })}
              </AlertDescription>
            </Alert>
          )}

          {/* Continue Button */}
          <Button
            size="lg"
            className="w-full"
            disabled={!isValid || isSubmitting}
            onClick={handleContinueToPayment}
          >
            {isSubmitting ? (
              <>
                <Loader2
                  className="mr-2 h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
                {t('continueToPayment')}
              </>
            ) : (
              <>
                {t('continueToPayment')}
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </>
            )}
          </Button>

          {!isValid && (
            <p className="text-center text-sm text-slate-500">
              {!date
                ? t('selectDateFirst')
                : !time
                  ? t('selectTimeFirst')
                  : t('selectGuestsFirst')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
