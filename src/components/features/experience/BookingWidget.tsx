'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { BookingDatePicker } from '@/components/features/booking/BookingDatePicker';
import { TimeSlotSelector } from '@/components/features/booking/TimeSlotSelector';
import { GuestCountInput } from '@/components/features/booking/GuestCountInput';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BookingWidgetProps {
  price: number;
  experienceSlug: string;
  experienceId: string;
  stripeConnected: boolean;
  minCapacity: number;
  maxCapacity: number;
  availabilitySlots?: AvailabilitySlot[];
}

export function BookingWidget({
  price,
  experienceSlug,
  experienceId,
  stripeConnected,
  minCapacity,
  maxCapacity,
  availabilitySlots = [],
}: BookingWidgetProps) {
  const t = useTranslations('booking');
  const router = useRouter();

  // URL state persistence using nuqs
  const [queryState, setQueryState] = useQueryStates({
    date: parseAsString,
    time: parseAsString,
    guests: parseAsInteger.withDefault(Math.max(2, minCapacity)),
  });

  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { date, time, guests } = queryState;
  const isBookingEnabled = stripeConnected;

  // Available days based on availability slots
  const availableDays = useMemo(
    () => new Set(availabilitySlots.filter(s => s.isActive).map((slot) => slot.dayOfWeek)),
    [availabilitySlots]
  );

  // Check if form is valid
  const isValid = date && time &&
    guests >= minCapacity &&
    guests <= maxCapacity &&
    (remainingCapacity === null || guests <= remainingCapacity);

  const totalPrice = price * guests;

  const handleDateChange = useCallback(
    (newDate: string | null) => {
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

  const handleCapacityUpdate = useCallback((capacity: number | null) => {
    setRemainingCapacity(capacity);
  }, []);

  const handleContinue = () => {
    if (!isValid || !isBookingEnabled) return;

    setIsSubmitting(true);
    const params = new URLSearchParams({
      date: date!,
      time: time!,
      guests: guests.toString(),
    });
    router.push(`/experiences/${experienceSlug}/checkout?${params.toString()}`);
  };

  return (
    <div
      className="sticky top-28 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6 lg:p-8"
      data-testid="booking-widget"
      id="booking-widget"
    >
      {/* Price Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-sm text-gray-500">Price per person</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#1a0f12]" data-testid="booking-price">
              {formatCHF(price)}
            </span>
          </div>
        </div>
        {isBookingEnabled && (
          <div className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
            AVAILABLE
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {/* Date Picker */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#1a0f12]">
            {t('selectDate')}
          </label>
          <BookingDatePicker
            selectedDate={date}
            onDateChange={handleDateChange}
            availableDays={availableDays}
          />
        </div>

        {/* Time Slots */}
        {date && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#1a0f12]">
              {t('selectTime')}
            </label>
            <TimeSlotSelector
              experienceId={experienceId}
              selectedDate={date}
              selectedTime={time}
              onTimeChange={handleTimeChange}
              onCapacityUpdate={handleCapacityUpdate}
            />
          </div>
        )}

        {/* Guests */}
        {time && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#1a0f12]">
              {t('selectGuests')}
            </label>
            <GuestCountInput
              value={guests}
              onChange={handleGuestsChange}
              min={minCapacity}
              max={remainingCapacity !== null ? Math.min(maxCapacity, remainingCapacity) : maxCapacity}
              isLoading={false}
              remainingCapacity={remainingCapacity}
            />
          </div>
        )}

        {/* Show total when form is partially filled */}
        {date && (
          <>
            <hr className="border-dashed border-gray-200 my-2" />

            {/* Total */}
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-lg text-[#1a0f12]">
                {t('totalPrice')}
              </span>
              <span className="font-bold text-xl text-primary" data-testid="booking-total">
                {formatCHF(totalPrice)}
              </span>
            </div>
          </>
        )}

        {/* Book Button */}
        {isBookingEnabled ? (
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-[#b02245] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 h-auto"
            disabled={!isValid || isSubmitting}
            onClick={handleContinue}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('continueToPayment')}</span>
              </>
            ) : (
              <>
                <span>{isValid ? t('continueToPayment') : t('bookExperience')}</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-[#b02245] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 h-auto opacity-90"
            disabled
          >
            <span>{t('bookExperience')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {isBookingEnabled && (
          <p className="text-xs text-center text-gray-400 mt-2">
            Free cancellation up to 24h before.
          </p>
        )}
      </div>

      {/* Coming Soon Badge - Only show when booking not enabled */}
      {!isBookingEnabled && (
        <div className="mt-4 rounded-lg border-2 border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-gold-100/50 p-4 text-center">
          <p className="text-sm font-medium text-gold-900">
            {t('comingSoonTitle')}
          </p>
          <p className="mt-1 text-xs text-gold-700">{t('contactWinery')}</p>
        </div>
      )}
    </div>
  );
}
