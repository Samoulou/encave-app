'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface BookingWidgetProps {
  price: number;
  experienceSlug: string;
  stripeConnected: boolean;
  minCapacity: number;
  maxCapacity: number;
  availabilitySlots?: AvailabilitySlot[];
}

// Format time from 24h to display format
function formatTime(time: string): string {
  const [hours] = time.split(':');
  return `${hours}:00`;
}

// Get available times from slots for display
function getDisplayTimes(slots: AvailabilitySlot[]): string[] {
  const times = new Set<string>();
  slots.forEach((slot) => {
    if (slot.isActive) {
      times.add(formatTime(slot.startTime));
    }
  });
  return Array.from(times).slice(0, 4); // Show max 4 time slots
}

export function BookingWidget({
  price,
  experienceSlug,
  stripeConnected,
  minCapacity,
  maxCapacity,
  availabilitySlots = [],
}: BookingWidgetProps) {
  const t = useTranslations('booking');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(Math.max(2, minCapacity));

  const isBookingEnabled = stripeConnected;
  const displayTimes = useMemo(
    () => getDisplayTimes(availabilitySlots),
    [availabilitySlots]
  );

  const totalPrice = price * guests;

  const decreaseGuests = () => {
    if (guests > minCapacity) {
      setGuests(guests - 1);
    }
  };

  const increaseGuests = () => {
    if (guests < maxCapacity) {
      setGuests(guests + 1);
    }
  };

  return (
    <div
      className="sticky top-28 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] p-6 lg:p-8"
      data-testid="booking-widget"
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
        <div className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
          AVAILABLE
        </div>
      </div>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Date Picker (Simplified - links to booking page) */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#1a0f12]">
            {t('selectDate')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary bg-background-light text-sm text-[#1a0f12]"
              placeholder="Select a date"
              readOnly
            />
          </div>
        </div>

        {/* Time Slots */}
        {displayTimes.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#1a0f12]">
              {t('selectTime')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {displayTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`border-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTime === time
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 hover:border-primary text-gray-600'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Guests */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[#1a0f12]">
            {t('selectGuests')}
          </label>
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-background-light">
            <span className="text-sm text-gray-600">Adults</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={decreaseGuests}
                disabled={guests <= minCapacity}
                className="size-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('decreaseGuests')}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-base font-semibold w-4 text-center">
                {guests}
              </span>
              <button
                type="button"
                onClick={increaseGuests}
                disabled={guests >= maxCapacity}
                className="size-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('increaseGuests')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

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

        {/* Book Button */}
        {isBookingEnabled ? (
          <Button
            size="lg"
            className="w-full bg-primary hover:bg-[#b02245] text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 h-auto"
            asChild
          >
            <Link href={`/experiences/${experienceSlug}/book?guests=${guests}`}>
              <span>{t('bookExperience')}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
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

        <p className="text-xs text-center text-gray-400 mt-2">
          Free cancellation up to 24h before.
        </p>
      </form>

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
