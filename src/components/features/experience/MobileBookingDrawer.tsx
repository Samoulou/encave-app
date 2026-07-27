'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { enUS, fr, de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { formatCHF } from '@/lib/utils/currency';
import { BookingDatePicker } from '@/components/features/booking/BookingDatePicker';
import { HoldCapacityError } from '@/components/features/booking/HoldCapacityError';
import { TimeSlotSelector } from '@/components/features/booking/TimeSlotSelector';
import { GuestCountInput } from '@/components/features/booking/GuestCountInput';
import { BookingStepIndicator } from '@/components/features/booking/BookingStepIndicator';
import { useBookingHold } from '@/hooks/useBookingHold';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface MobileBookingDrawerProps {
  isOpen: boolean;
  onOpenChange: (_open: boolean) => void;
  price: number;
  /** Client booking fee per ticket in cents — 0 when BOOKING_FEE is OFF. */
  serviceFeeCentsPerGuest?: number;
  experienceSlug: string;
  experienceId: string;
  minCapacity: number;
  maxCapacity: number;
  duration: number;
  availabilitySlots: AvailabilitySlot[];
  /**
   * "YYYY-MM-DD" keys of bookable occurrences (P-05) — enables punctual
   * dates that no weekly slot covers. Server-computed with dateKeyOf.
   */
  occurrenceDateKeys?: string[];
}

const dateLocales = { en: enUS, fr, de } as const;

export function MobileBookingDrawer({
  isOpen,
  onOpenChange,
  price,
  serviceFeeCentsPerGuest = 0,
  experienceSlug,
  experienceId,
  minCapacity,
  maxCapacity,
  duration,
  availabilitySlots,
  occurrenceDateKeys = [],
}: MobileBookingDrawerProps) {
  const t = useTranslations('booking');
  const tCheckout = useTranslations('checkout');
  const locale = useLocale();

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(Math.max(2, minCapacity));
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null
  );
  const { continueToCheckout, isSubmitting, holdError, clearHoldError } =
    useBookingHold(experienceId, experienceSlug);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);

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

  // Punctual occurrence dates selectable on top of the weekly days (P-05).
  const occurrenceDays = useMemo(
    () => new Set(occurrenceDateKeys),
    [occurrenceDateKeys]
  );

  // Check if form is valid
  const isValid =
    date &&
    time &&
    guests >= minCapacity &&
    guests <= maxCapacity &&
    (remainingCapacity === null || guests <= remainingCapacity);

  const serviceFee = serviceFeeCentsPerGuest * guests;
  const totalPrice = price * guests + serviceFee;

  const handleDateChange = useCallback(
    (newDate: string | null) => {
      setDate(newDate);
      setTime(null);
      setRemainingCapacity(null);
      clearHoldError();
      if (newDate) {
        setMobileStep(2);
      }
    },
    [clearHoldError]
  );

  const handleTimeChange = useCallback(
    (newTime: string | null) => {
      setTime(newTime);
      clearHoldError();
      if (newTime) {
        setMobileStep(3);
      }
    },
    [clearHoldError]
  );

  const handleGuestsChange = useCallback(
    (newGuests: number) => {
      setGuests(newGuests);
      clearHoldError();
    },
    [clearHoldError]
  );

  const handleCapacityUpdate = useCallback((capacity: number | null) => {
    setRemainingCapacity(capacity);
  }, []);

  const handleBack = () => {
    if (mobileStep === 2) {
      setMobileStep(1);
    } else if (mobileStep === 3) {
      setMobileStep(2);
    }
  };

  const handleContinue = () => {
    if (!isValid || !date || !time || isSubmitting) return;

    // Hold the slot for 10 min BEFORE the checkout form (P-04 / L-050) —
    // the shared hook owns double-click guarding, previous-hold release
    // and soft degradation.
    void continueToCheckout({ date, time, guests });
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

  // Reset state when drawer closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMobileStep(1);
      setDate(null);
      setTime(null);
      setGuests(Math.max(2, minCapacity));
      setRemainingCapacity(null);
      clearHoldError();
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] overflow-y-auto rounded-t-2xl"
      >
        {/* Header with back button and step dots */}
        <SheetHeader className="pb-2 text-left">
          <div className="flex items-center gap-3">
            {mobileStep > 1 && (
              <button
                onClick={handleBack}
                className="-ml-1.5 rounded-lg p-1.5 transition-colors hover:bg-stone-100"
                aria-label={t('back') ?? 'Back'}
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            <SheetTitle className="flex-1">{t('bookExperience')}</SheetTitle>
          </div>
          <SheetDescription>
            <span className="text-lg font-bold text-foreground">
              {formatCHF(price)}
            </span>
            <span className="ml-1 text-muted-foreground">
              / {t('perPerson')}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Step indicator */}
        <div className="py-2">
          <BookingStepIndicator currentStep={mobileStep} />
        </div>

        <div className="flex flex-col pb-28">
          {/* Step 1: Calendar */}
          {mobileStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">
                {t('selectDate')}
              </p>
              <BookingDatePicker
                selectedDate={date}
                onDateChange={handleDateChange}
                availableDays={availableDays}
                occurrenceDateKeys={occurrenceDays}
              />
            </div>
          )}

          {/* Step 2: Session cards */}
          {mobileStep === 2 && date && (
            <div className="space-y-4">
              {/* Context: selected date */}
              <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{formatDateLabel(date)}</span>
              </div>

              <p className="text-sm font-semibold text-foreground">
                {t('whenVisit')}
              </p>
              <TimeSlotSelector
                experienceId={experienceId}
                selectedDate={date}
                selectedTime={time}
                onTimeChange={handleTimeChange}
                onCapacityUpdate={handleCapacityUpdate}
              />
            </div>
          )}

          {/* Step 3: Guests + Summary */}
          {mobileStep === 3 && time && date && (
            <div className="space-y-5">
              {/* Context: selected date + time */}
              <div className="flex flex-col gap-1.5 rounded-lg bg-stone-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar
                    className="h-4 w-4 text-primary"
                    aria-hidden="true"
                  />
                  <span>{formatDateLabel(date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>
                    {formatTime(time)} ({duration} min)
                  </span>
                </div>
              </div>

              <p className="text-sm font-semibold text-foreground">
                {t('selectGuests')}
              </p>
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

              {/* Summary card */}
              {isValid && (
                <>
                  <hr className="border-dashed border-stone-200" />
                  {serviceFee > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {guests} × {formatCHF(price)}
                      </span>
                      <span>{formatCHF(price * guests)}</span>
                    </div>
                  )}
                  {serviceFee > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{tCheckout('serviceFee')}</span>
                      <span>{formatCHF(serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {serviceFee > 0
                        ? tCheckout('totalCHF')
                        : `${guests} × ${formatCHF(price)}`}
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {formatCHF(totalPrice)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4">
          {holdError && mobileStep === 3 && (
            <HoldCapacityError message={holdError} />
          )}
          {mobileStep === 1 && (
            <Button
              size="lg"
              className="hover:bg-primary-hover flex h-auto w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all"
              disabled={!date}
              onClick={() => date && setMobileStep(2)}
            >
              <span>{t('nextSession')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {mobileStep === 2 && (
            <Button
              size="lg"
              className="hover:bg-primary-hover flex h-auto w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all"
              disabled={!time}
              onClick={() => time && setMobileStep(3)}
            >
              <span>{t('nextGuests')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {mobileStep === 3 && (
            <Button
              size="lg"
              className="hover:bg-primary-hover flex h-auto w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all"
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
                  <span>{t('continueToPayment')}</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
