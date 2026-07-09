'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { CancellationPolicy } from '@prisma/client';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { de, enUS, fr } from 'date-fns/locale';
import { Check, ChevronRight, Lock, Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeSlotSelector } from '@/components/features/booking/TimeSlotSelector';
import { formatCHF } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { capturePostHog } from '@/lib/posthog-client';

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
  /** Client booking fee per ticket in cents — 0 when BOOKING_FEE is OFF. */
  serviceFeeCentsPerGuest?: number;
  /** Winery cancellation policy — drives the free-cancellation badge. */
  cancellationPolicy?: CancellationPolicy;
}

const dateLocales = { en: enUS, fr, de } as const;

export function BookingWidget({
  price,
  experienceSlug,
  experienceId,
  stripeConnected,
  minCapacity,
  maxCapacity,
  duration: _duration,
  availabilitySlots = [],
  serviceFeeCentsPerGuest = 0,
  cancellationPolicy = 'STANDARD',
}: BookingWidgetProps) {
  const t = useTranslations('booking');
  const tExp = useTranslations('experience');
  const tCheckout = useTranslations('checkout');
  const router = useRouter();
  const locale = useLocale();

  const [queryState, setQueryState] = useQueryStates({
    date: parseAsString,
    time: parseAsString,
    guests: parseAsInteger.withDefault(Math.max(2, minCapacity)),
  });

  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { date, time, guests } = queryState;
  const isBookingEnabled = stripeConnected;

  const availableDays = useMemo(
    () =>
      new Set(
        availabilitySlots
          .filter((slot) => slot.isActive)
          .map((slot) => slot.dayOfWeek)
      ),
    [availabilitySlots]
  );

  const dateOptions = useMemo(() => {
    const today = startOfDay(new Date());
    const loc = dateLocales[locale as keyof typeof dateLocales] ?? enUS;
    const options: Array<{
      value: string;
      day: string;
      date: string;
      disabled: boolean;
    }> = [];

    for (let offset = 0; options.length < 6 && offset < 30; offset++) {
      const candidate = addDays(today, offset);
      const disabled = !availableDays.has(candidate.getDay());
      if (disabled && options.length >= 5) continue;
      options.push({
        value: format(candidate, 'yyyy-MM-dd'),
        day: format(candidate, 'EEE', { locale: loc }).slice(0, 3),
        date: format(candidate, 'd', { locale: loc }),
        disabled,
      });
    }

    return options;
  }, [availableDays, locale]);

  const isValid =
    date &&
    time &&
    guests >= minCapacity &&
    guests <= maxCapacity &&
    (remainingCapacity === null || guests <= remainingCapacity);

  const totalPrice = price * guests;
  const serviceFee = serviceFeeCentsPerGuest * guests;
  const totalWithFees = totalPrice + serviceFee;

  const handleDateChange = useCallback(
    (newDate: string | null) => {
      setQueryState({ date: newDate, time: null });
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

    capturePostHog('booking_started', {
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

  const formatDateLabel = (dateStr: string) => {
    try {
      const parsedDate = parseISO(dateStr);
      const loc = dateLocales[locale as keyof typeof dateLocales] ?? enUS;
      return format(parsedDate, 'EEE d MMM', { locale: loc });
    } catch {
      return dateStr;
    }
  };

  const ctaText = !date
    ? t('selectDate')
    : !time
      ? t('step.selectSession')
      : !isValid
        ? t('selectGuests')
        : t('continueToPayment');

  const effectiveMax =
    remainingCapacity !== null
      ? Math.min(maxCapacity, remainingCapacity)
      : maxCapacity;
  const canDecrement = guests > minCapacity;
  const canIncrement = guests < effectiveMax;

  return (
    <div
      className="sticky top-20 rounded-[18px] border border-stone-200 bg-white p-6 shadow-[0_6px_24px_rgba(58,14,31,0.06)]"
      data-testid="booking-widget"
      id="booking-widget"
    >
      <div className="mb-1 flex items-baseline justify-between">
        <div className="font-display text-[30px] font-semibold text-ink-900">
          <span data-testid="experience-price">{formatCHF(price)}</span>
          <span className="ml-1 font-sans text-sm text-ink-500">
            / {t('perPerson')}
          </span>
        </div>
        <span className="rounded-full bg-burgundy-50 px-2 py-1 text-[11px] font-semibold text-burgundy-700">
          {isBookingEnabled ? tExp('available') : t('comingSoonTitle')}
        </span>
      </div>

      <div className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-vine">
        <Check className="h-3.5 w-3.5" />
        {tExp(`freeCancellationPolicy.${cancellationPolicy}`)}
      </div>

      <div className="border-t border-stone-200 pt-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
          Choisissez un jour
        </div>
        <div
          className="flex gap-1.5"
          role="application"
          aria-label="calendar"
          data-testid="booking-date-options"
        >
          {dateOptions.map((option) => {
            const selected = date === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => handleDateChange(option.value)}
                data-testid={`booking-date-${option.value}`}
                className={cn(
                  'h-[62px] flex-1 rounded-[10px] border-[1.5px] font-mono text-[11px] transition-colors',
                  selected
                    ? 'border-burgundy-600 bg-burgundy-600 text-white'
                    : 'border-stone-200 bg-white text-ink-900 hover:border-burgundy-200',
                  option.disabled &&
                    'cursor-not-allowed text-ink-300 opacity-50 hover:border-stone-200'
                )}
              >
                <div className="text-[9px] uppercase tracking-[0.1em] opacity-70">
                  {option.day}
                </div>
                <div className="mt-0.5 text-base font-bold">{option.date}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-stone-200 pt-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
          Horaire{date ? ` · ${formatDateLabel(date)}` : ''}
        </div>
        <div data-testid="time-slot-section">
          <TimeSlotSelector
            experienceId={experienceId}
            selectedDate={date}
            selectedTime={time}
            onTimeChange={handleTimeChange}
            onCapacityUpdate={handleCapacityUpdate}
          />
        </div>
      </div>

      <div
        className="mt-4 flex items-center justify-between border-y border-stone-200 py-3"
        data-testid="guest-count-section"
      >
        <div>
          <div className="text-[13px] font-semibold text-ink-900">
            Participants
          </div>
          <div className="text-[11px] text-ink-500">
            {remainingCapacity !== null
              ? `${remainingCapacity} places encore disponibles`
              : `${maxCapacity} places maximum`}
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            disabled={!canDecrement}
            onClick={() => handleGuestsChange(guests - 1)}
            className="grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-stone-200 bg-white text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('decreaseGuests')}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span
            className="min-w-[16px] text-center font-mono text-base font-bold"
            data-testid="guest-count-display"
          >
            {guests}
          </span>
          <button
            type="button"
            disabled={!canIncrement}
            onClick={() => handleGuestsChange(guests + 1)}
            className="grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-stone-200 bg-white text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('increaseGuests')}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="my-4 space-y-1.5 text-[13px] text-ink-700"
        data-testid="price-section"
      >
        <div
          className="flex items-center justify-between"
          data-testid="price-breakdown"
        >
          <span>
            {guests} x {formatCHF(price)}
          </span>
          <span>{formatCHF(totalPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-ink-500">
          <span>{tCheckout('serviceFee')}</span>
          <span>{formatCHF(serviceFee)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-[15px] font-bold text-ink-900">
          <span>Total</span>
          <span className="text-burgundy-700" data-testid="total-price">
            {formatCHF(totalWithFees)}
          </span>
        </div>
      </div>

      {isBookingEnabled ? (
        <Button
          size="lg"
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-burgundy-600 text-[15px] font-bold text-white shadow-primary transition-all hover:bg-burgundy-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!isValid || isSubmitting}
          onClick={handleContinue}
          data-testid="continue-to-checkout"
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
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-burgundy-600 text-[15px] font-bold text-white opacity-40"
          disabled
        >
          <span>{t('bookExperience')}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {isBookingEnabled && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-500">
          <Lock className="h-3 w-3" />
          Paiement Stripe · vous ne serez debite qu&apos;a la confirmation
        </p>
      )}

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
