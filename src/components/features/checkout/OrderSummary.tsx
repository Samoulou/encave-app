'use client';

import { Calendar, Users, MapPin, Info } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';
import Image from 'next/image';
import type { CancellationPolicy } from '@prisma/client';
import { formatCHF } from '@/lib/utils/currency';
import { CancellationPolicyInfo } from '@/components/features/experience/CancellationPolicyInfo';

const localeMap = { fr, de, en: enUS } as const;

interface OrderSummaryProps {
  experienceTitle: string;
  experienceImage?: string | null;
  location: string;
  date: string;
  time: string;
  duration?: number;
  guestCount: number;
  pricePerPerson: number;
  serviceFee?: number;
  /** Gift-card amount applied at checkout in cents (P-09), 0 when none. */
  giftAppliedCents?: number;
  /** Winery cancellation policy — falls back to the legacy note if absent. */
  cancellationPolicy: CancellationPolicy;
}

function formatTimeRange(time: string, durationHours?: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const startTime = `${String(hours).padStart(2, '0')}:${String(minutes ?? 0).padStart(2, '0')}`;

  if (durationHours) {
    const endHours = (hours ?? 0) + durationHours;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes ?? 0).padStart(2, '0')}`;
    return `${startTime} - ${endTime} (${durationHours}h)`;
  }

  return startTime;
}

export function OrderSummary({
  experienceTitle,
  experienceImage,
  location,
  date,
  time,
  duration,
  guestCount,
  pricePerPerson,
  serviceFee = 0,
  giftAppliedCents = 0,
  cancellationPolicy,
}: OrderSummaryProps) {
  const t = useTranslations('checkout');
  const tBooking = useTranslations('booking');
  const locale = useLocale();
  const dateLocale = localeMap[locale as keyof typeof localeMap] || enUS;

  const parsedDate = parseISO(date);
  const formattedDate = format(parsedDate, 'EEE, d MMM', {
    locale: dateLocale,
  });
  const subtotal = pricePerPerson * guestCount;
  const total = Math.max(0, subtotal + serviceFee - giftAppliedCents);

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-white shadow-lg"
      data-testid="checkout-summary"
    >
      {/* Image Header with Gradient Overlay */}
      <div className="relative h-48 w-full">
        {experienceImage ? (
          <Image
            src={experienceImage}
            alt={experienceTitle}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-burgundy-100 to-burgundy-200" />
        )}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6">
          <h3
            className="text-xl font-bold leading-tight text-white drop-shadow-sm"
            data-testid="summary-experience-title"
          >
            {experienceTitle}
          </h3>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* Details List */}
        <div className="flex flex-col gap-4 border-b border-[#f2e9eb] pb-6">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="flex w-8 justify-center pt-0.5">
              <Calendar
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div>
              <p
                className="font-bold text-foreground"
                data-testid="summary-date"
              >
                {formattedDate}
              </p>
              <p
                className="text-sm text-muted-foreground"
                data-testid="summary-time"
              >
                {formatTimeRange(time, duration)}
              </p>
            </div>
          </div>

          {/* Guests */}
          <div className="flex items-start gap-3">
            <div className="flex w-8 justify-center pt-0.5">
              <Users
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div>
              <p
                className="font-bold text-foreground"
                data-testid="summary-guests"
              >
                {tBooking('guests', { count: guestCount })}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <div className="flex w-8 justify-center pt-0.5">
              <MapPin
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div>
              <p
                className="font-bold text-foreground"
                data-testid="summary-winery-name"
              >
                {location}
              </p>
              <button
                type="button"
                className="cursor-pointer text-sm text-muted-foreground hover:underline"
              >
                {t('viewOnMap')}
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="space-y-3 pt-6">
          <div className="flex justify-between text-foreground">
            <span data-testid="summary-price-per-person">
              {formatCHF(pricePerPerson)} ×{' '}
              {tBooking('guests', { count: guestCount })}
            </span>
            <span>{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-foreground">
            <span>{t('serviceFee')}</span>
            <span>{formatCHF(serviceFee)}</span>
          </div>
          {giftAppliedCents > 0 && (
            <div className="flex justify-between text-primary">
              <span>{t('giftApplied')}</span>
              <span data-testid="summary-gift">
                −{formatCHF(giftAppliedCents)}
              </span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-[#f2e9eb] pt-4">
            <span className="text-lg font-bold text-foreground">
              {t('totalCHF')}
            </span>
            <span
              className="text-2xl font-bold text-primary"
              data-testid="summary-total"
            >
              {formatCHF(total)}
            </span>
          </div>
        </div>

        {/* Cancellation Policy Note */}
        <div className="mt-6 border-t border-dashed border-border pt-4">
          <div className="flex items-start gap-2">
            <Info
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <CancellationPolicyInfo
              policy={cancellationPolicy}
              className="text-xs leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
