'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Calendar, Clock, ChevronRight, Loader2 } from 'lucide-react';
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
import { TimeSlotSelector } from '@/components/features/booking/TimeSlotSelector';
import { GuestCountInput } from '@/components/features/booking/GuestCountInput';
import { BookingStepIndicator } from '@/components/features/booking/BookingStepIndicator';

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
  experienceSlug: string;
  experienceId: string;
  minCapacity: number;
  maxCapacity: number;
  duration: number;
  availabilitySlots: AvailabilitySlot[];
}

const dateLocales = { en: enUS, fr, de } as const;

export function MobileBookingDrawer({
  isOpen,
  onOpenChange,
  price,
  experienceSlug,
  experienceId,
  minCapacity,
  maxCapacity,
  duration,
  availabilitySlots,
}: MobileBookingDrawerProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const locale = useLocale();

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(Math.max(2, minCapacity));
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);

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

  const handleDateChange = useCallback((newDate: string | null) => {
    setDate(newDate);
    setTime(null);
    setRemainingCapacity(null);
    if (newDate) {
      setMobileStep(2);
    }
  }, []);

  const handleTimeChange = useCallback((newTime: string | null) => {
    setTime(newTime);
    if (newTime) {
      setMobileStep(3);
    }
  }, []);

  const handleGuestsChange = useCallback((newGuests: number) => {
    setGuests(newGuests);
  }, []);

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
    if (!isValid) return;

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

  // Reset state when drawer closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMobileStep(1);
      setDate(null);
      setTime(null);
      setGuests(Math.max(2, minCapacity));
      setRemainingCapacity(null);
      setIsSubmitting(false);
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
        {/* Header with back button and step dots */}
        <SheetHeader className="text-left pb-2">
          <div className="flex items-center gap-3">
            {mobileStep > 1 && (
              <button
                onClick={handleBack}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                aria-label={t('back') ?? 'Back'}
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            <SheetTitle className="flex-1">{t('bookExperience')}</SheetTitle>
          </div>
          <SheetDescription>
            <span className="text-lg font-bold text-foreground">{formatCHF(price)}</span>
            <span className="text-muted-foreground ml-1">/ {t('perPerson')}</span>
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
              />
            </div>
          )}

          {/* Step 2: Session cards */}
          {mobileStep === 2 && date && (
            <div className="space-y-4">
              {/* Context: selected date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-stone-50 rounded-lg px-3 py-2">
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
          {mobileStep === 3 && time && (
            <div className="space-y-5">
              {/* Context: selected date + time */}
              <div className="flex flex-col gap-1.5 bg-stone-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{formatDateLabel(date!)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{formatTime(time)} ({duration} min)</span>
                </div>
              </div>

              <p className="text-sm font-semibold text-foreground">
                {t('selectGuests')}
              </p>
              <GuestCountInput
                value={guests}
                onChange={handleGuestsChange}
                min={minCapacity}
                max={remainingCapacity !== null ? Math.min(maxCapacity, remainingCapacity) : maxCapacity}
                isLoading={false}
                remainingCapacity={remainingCapacity}
              />

              {/* Summary card */}
              {isValid && (
                <>
                  <hr className="border-dashed border-stone-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {guests} × {formatCHF(price)}
                    </span>
                    <span className="font-bold text-xl text-foreground">
                      {formatCHF(totalPrice)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-stone-200">
          {mobileStep === 1 && (
            <Button
              size="lg"
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 h-auto"
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
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 h-auto"
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
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 h-auto"
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
