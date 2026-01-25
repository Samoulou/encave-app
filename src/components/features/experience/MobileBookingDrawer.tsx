'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2 } from 'lucide-react';
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

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface MobileBookingDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  price: number;
  experienceSlug: string;
  experienceId: string;
  minCapacity: number;
  maxCapacity: number;
  availabilitySlots: AvailabilitySlot[];
}

export function MobileBookingDrawer({
  isOpen,
  onOpenChange,
  price,
  experienceSlug,
  experienceId,
  minCapacity,
  maxCapacity,
  availabilitySlots,
}: MobileBookingDrawerProps) {
  const t = useTranslations('booking');
  const router = useRouter();

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(Math.max(2, minCapacity));
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setRemainingCapacity(null);
  }, []);

  const handleTimeChange = useCallback((newTime: string | null) => {
    setTime(newTime);
  }, []);

  const handleGuestsChange = useCallback((newGuests: number) => {
    setGuests(newGuests);
  }, []);

  const handleCapacityUpdate = useCallback((capacity: number | null) => {
    setRemainingCapacity(capacity);
  }, []);

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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('bookExperience')}</SheetTitle>
          <SheetDescription>
            <span className="text-lg font-bold text-[#1a0f12]">{formatCHF(price)}</span>
            <span className="text-gray-500 ml-1">/ {t('perPerson')}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 pb-24">
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
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg text-[#1a0f12]">
                  {t('totalPrice')}
                </span>
                <span className="font-bold text-xl text-primary">
                  {formatCHF(totalPrice)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Fixed bottom button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-[#b02245] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 h-auto"
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
