'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import posthog from 'posthog-js';
import { parseAsString, parseAsInteger, useQueryStates } from 'nuqs';
import {
  Calendar,
  Clock,
  Users,
  ChevronRight,
  Loader2,
  Pencil,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { enUS, fr, de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { BookingDatePicker } from '@/components/features/booking/BookingDatePicker';
import { TimeSlotSelector } from '@/components/features/booking/TimeSlotSelector';
import { GuestCountInput } from '@/components/features/booking/GuestCountInput';
import { BookingStepIndicator } from '@/components/features/booking/BookingStepIndicator';

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
  duration: number;
  availabilitySlots?: AvailabilitySlot[];
}

const dateLocales = { en: enUS, fr, de } as const;

export function BookingWidget({
  price,
  experienceSlug,
  experienceId,
  stripeConnected,
  minCapacity,
  maxCapacity,
  duration,
  availabilitySlots = [],
}: BookingWidgetProps) {
  const t = useTranslations('booking');
  const tExp = useTranslations('experience');
  const router = useRouter();
  const locale = useLocale();

  // URL state persistence using nuqs
  const [queryState, setQueryState] = useQueryStates({
    date: parseAsString,
    time: parseAsString,
    guests: parseAsInteger.withDefault(Math.max(2, minCapacity)),
  });

  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);

  const { date, time, guests } = queryState;
  const isBookingEnabled = stripeConnected;

  // Available days based on availability slots
  const availableDays = useMemo(
    () =>
      new Set(
        availabilitySlots
          .filter((s) => s.isActive)
          .map((slot) => slot.dayOfWeek)
      ),
    [availabilitySlots]
  );

  // Check if form is valid
  const isValid =
    date &&
    time &&
    guests >= minCapacity &&
    guests <= maxCapacity &&
    (remainingCapacity === null || guests <= remainingCapacity);

  const totalPrice = price * guests;

  const handleDateChange = useCallback(
    (newDate: string | null) => {
      setQueryState({ date: newDate, time: null });
      setRemainingCapacity(null);
      setSelectedEndTime(null);
      if (newDate) {
        setCurrentStep(2);
      }
    },
    [setQueryState]
  );

  const handleTimeChange = useCallback(
    (newTime: string | null) => {
      setQueryState({ time: newTime });
      if (newTime) {
        setCurrentStep(3);
      }
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

  const handleEditStep = (step: 1 | 2 | 3) => {
    setCurrentStep(step);
    if (step === 1) {
      setQueryState({ date: null, time: null });
      setRemainingCapacity(null);
      setSelectedEndTime(null);
    } else if (step === 2) {
      setQueryState({ time: null });
      setRemainingCapacity(null);
      setSelectedEndTime(null);
    }
  };

  const handleContinue = () => {
    if (!isValid || !isBookingEnabled) return;

    posthog.capture('booking_started', {
      experience_id: experienceId,
      experience_slug: experienceSlug,
      date,
      time_slot: time,
      guest_count: guests,
      total_price_chf: totalPrice / 100,
    });

    setIsSubmitting(true);
    const params = new URLSearchParams({
      date: date!,
      time: time!,
      guests: guests.toString(),
    });
    router.push(`/experiences/${experienceSlug}/checkout?${params.toString()}`);
  };

  const formatTime = (t: string) => {
    const parts = t.split(':');
    return `${(parts[0] ?? '00').padStart(2, '0')}:${(parts[1] ?? '00').padStart(2, '0')}`;
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      const loc = dateLocales[locale as keyof typeof dateLocales] ?? enUS;
      return format(d, 'EEE, d MMM', { locale: loc });
    } catch {
      return dateStr;
    }
  };

  // Determine CTA text
  const ctaText = !date
    ? t('selectDate')
    : !time
      ? t('step.selectSession')
      : currentStep === 3 && !isValid
        ? t('selectGuests')
        : t('continueToPayment');

  // Determine effective step based on state
  const effectiveStep = !date ? 1 : !time ? 2 : 3;

  // Wrap onTimeChange to also capture endTime
  const handleTimeChangeWithEnd = useCallback(
    (newTime: string | null) => {
      handleTimeChange(newTime);
    },
    [handleTimeChange]
  );

  return (
    <div
      className="sticky top-28 overflow-hidden rounded-2xl bg-white shadow-warm-xl"
      data-testid="booking-widget"
      id="booking-widget"
    >
      {/* Price Header */}
      <div className="flex items-end justify-between px-6 pb-4 pt-6">
        <div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold text-foreground"
              data-testid="booking-price"
            >
              {formatCHF(price)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {t('perPerson')}
            </span>
          </div>
        </div>
        {isBookingEnabled && (
          <div className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
            {tExp('available')}
          </div>
        )}
      </div>

      {/* Step Indicator */}
      <div className="px-6">
        <BookingStepIndicator currentStep={effectiveStep} />
      </div>

      <div className="border-t border-stone-100" />

      {/* Step 1: Date */}
      {currentStep === 1 ? (
        <div className="px-6 py-4">
          <BookingDatePicker
            selectedDate={date}
            onDateChange={handleDateChange}
            availableDays={availableDays}
          />
        </div>
      ) : date ? (
        <button
          onClick={() => handleEditStep(1)}
          className="flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-stone-50"
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              {formatDateLabel(date)}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" />
            {t('editSelection')}
          </span>
        </button>
      ) : null}

      <div className="border-t border-stone-100" />

      {/* Step 2: Session */}
      {currentStep === 2 && date ? (
        <div className="px-6 py-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            {t('whenVisit')}
          </p>
          <TimeSlotSelector
            experienceId={experienceId}
            selectedDate={date}
            selectedTime={time}
            onTimeChange={handleTimeChangeWithEnd}
            onCapacityUpdate={handleCapacityUpdate}
          />
        </div>
      ) : time && currentStep > 2 ? (
        <button
          onClick={() => handleEditStep(2)}
          className="flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-stone-50"
        >
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              {formatTime(time)}
              {selectedEndTime
                ? ` → ${formatTime(selectedEndTime)}`
                : ` (${duration} min)`}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" />
            {t('editSelection')}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2.5 px-6 py-3.5 text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">{t('step.session')}</span>
          <span className="ml-auto text-xs">···</span>
        </div>
      )}

      <div className="border-t border-stone-100" />

      {/* Step 3: Guests */}
      {currentStep === 3 && time ? (
        <div className="px-6 py-4">
          <GuestCountInput
            value={guests}
            onChange={handleGuestsChange}
            min={minCapacity}
            max={
              remainingCapacity !== null
                ? Math.min(maxCapacity, remainingCapacity)
                : maxCapacity
            }
            isLoading={false}
            remainingCapacity={remainingCapacity}
          />
        </div>
      ) : isValid ? (
        <button
          onClick={() => handleEditStep(3)}
          className="flex w-full items-center justify-between px-6 py-3.5 text-left transition-colors hover:bg-stone-50"
        >
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              {t('guests', { count: guests })}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pencil className="h-3 w-3" />
            {t('editSelection')}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2.5 px-6 py-3.5 text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">{t('step.guests')}</span>
          <span className="ml-auto text-xs">···</span>
        </div>
      )}

      <div className="border-t border-stone-100" />

      {/* Price Summary — only when all 3 steps complete */}
      {isValid && currentStep === 3 && (
        <div className="px-6 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {guests} × {formatCHF(price)}
            </span>
            <span
              className="text-lg font-bold text-foreground"
              data-testid="booking-total"
            >
              {formatCHF(totalPrice)}
            </span>
          </div>
        </div>
      )}

      {/* CTA Button */}
      <div className="px-6 pb-5 pt-3">
        {isBookingEnabled ? (
          <Button
            size="lg"
            className="hover:bg-primary-hover flex h-auto w-full transform items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
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
                <span>{ctaText}</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button
            size="lg"
            className="hover:bg-primary-hover flex h-auto w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white opacity-90 shadow-lg shadow-primary/20 transition-all"
            disabled
          >
            <span>{t('bookExperience')}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {isBookingEnabled && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {tExp('freeCancellation')}
          </p>
        )}
      </div>

      {/* Coming Soon Badge */}
      {!isBookingEnabled && (
        <div className="mx-6 mb-6 rounded-lg border-2 border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-gold-100/50 p-4 text-center">
          <p className="text-sm font-medium text-gold-900">
            {t('comingSoonTitle')}
          </p>
          <p className="mt-1 text-xs text-gold-700">{t('contactWinery')}</p>
        </div>
      )}
    </div>
  );
}
