'use client';

import { Calendar, Users, MapPin, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import { formatCHF } from '@/lib/utils/currency';

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
}: OrderSummaryProps) {
  const t = useTranslations('checkout');
  const tBooking = useTranslations('booking');

  const parsedDate = parseISO(date);
  const formattedDate = format(parsedDate, 'EEE, MMM d');
  const subtotal = pricePerPerson * guestCount;
  const total = subtotal + serviceFee;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-[#e5d2d7] overflow-hidden">
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
          <div className="w-full h-full bg-gradient-to-br from-burgundy-100 to-burgundy-200" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
          <h3 className="text-white text-xl font-bold leading-tight drop-shadow-sm">
            {experienceTitle}
          </h3>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* Details List */}
        <div className="flex flex-col gap-4 pb-6 border-b border-[#f2e9eb]">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="w-8 flex justify-center pt-0.5">
              <Calendar className="h-5 w-5 text-[#915564]" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-[#1a0f12]">{formattedDate}</p>
              <p className="text-sm text-[#915564]">{formatTimeRange(time, duration)}</p>
            </div>
          </div>

          {/* Guests */}
          <div className="flex items-start gap-3">
            <div className="w-8 flex justify-center pt-0.5">
              <Users className="h-5 w-5 text-[#915564]" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-[#1a0f12]">
                {tBooking('guests', { count: guestCount })}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <div className="w-8 flex justify-center pt-0.5">
              <MapPin className="h-5 w-5 text-[#915564]" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-[#1a0f12]">{location}</p>
              <button
                type="button"
                className="text-sm text-[#915564] hover:underline cursor-pointer"
              >
                {t('viewOnMap')}
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="pt-6 space-y-3">
          <div className="flex justify-between text-[#1a0f12]">
            <span>
              {formatCHF(pricePerPerson)} × {guestCount} {tBooking('guests', { count: guestCount }).toLowerCase()}
            </span>
            <span>{formatCHF(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#1a0f12]">
            <span>{t('serviceFee')}</span>
            <span>{formatCHF(serviceFee)}</span>
          </div>
          <div className="flex justify-between items-center pt-4 mt-2 border-t border-[#f2e9eb]">
            <span className="text-lg font-bold text-[#1a0f12]">{t('totalCHF')}</span>
            <span className="text-2xl font-bold text-primary">{formatCHF(total)}</span>
          </div>
        </div>

        {/* Cancellation Policy Note */}
        <div className="mt-6 pt-4 border-t border-dashed border-[#e5d2d7]">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-[#915564] mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-[#915564] leading-relaxed">
              <span className="font-bold text-[#1a0f12]">{t('freeCancellation')}</span>{' '}
              {t('cancellationPolicy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
