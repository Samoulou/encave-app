'use client';

import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, Users, Wine } from 'lucide-react';
import { formatCHF } from '@/lib/utils/currency';

interface BookingSummaryProps {
  experienceTitle: string;
  wineryName: string;
  date: string;
  time: string;
  guests: number;
  totalPrice: number;
}

function formatTime(time: string): string {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function BookingSummary({
  experienceTitle,
  wineryName,
  date,
  time,
  guests,
  totalPrice,
}: BookingSummaryProps) {
  const t = useTranslations('booking');

  const parsedDate = parseISO(date);
  const formattedDate = format(parsedDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">{t('bookingSummary')}</h3>

      {/* Experience */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy-100">
          <Wine className="h-4 w-4 text-burgundy-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('experience')}</p>
          <p className="font-medium text-slate-900">{experienceTitle}</p>
          <p className="text-sm text-slate-600">{wineryName}</p>
        </div>
      </div>

      {/* Date */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy-100">
          <Calendar className="h-4 w-4 text-burgundy-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('date')}</p>
          <p className="font-medium text-slate-900">{formattedDate}</p>
        </div>
      </div>

      {/* Time */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy-100">
          <Clock className="h-4 w-4 text-burgundy-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('time')}</p>
          <p className="font-medium text-slate-900">{formatTime(time)}</p>
        </div>
      </div>

      {/* Guests */}
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-burgundy-100">
          <Users className="h-4 w-4 text-burgundy-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t('selectGuests')}</p>
          <p className="font-medium text-slate-900">{t('guests', { count: guests })}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-slate-700">{t('totalPrice')}</span>
          <span className="text-xl font-bold text-burgundy-600">{formatCHF(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}
