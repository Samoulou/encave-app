'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslations, useLocale } from 'next-intl';
import { fr, de, enUS } from 'date-fns/locale';
import { BookingStatus, ExperienceType } from '@prisma/client';
import { Users, Clock, Ban, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/features/booking/dashboard/BookingStatusBadge';
import { ExperienceTypeDot } from './ExperienceTypeDot';
import { blockDateForAllExperiences, unblockDateForAllExperiences } from '@/server/actions/availability';
import { toast } from 'sonner';
import { formatCHF } from '@/lib/utils/currency';

interface DayBooking {
  id: string;
  reference: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  status: BookingStatus;
  experience: {
    id: string;
    title: string;
    type: ExperienceType;
    duration: number;
  };
}

interface DayDetailPanelProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  date: Date;
  bookings: DayBooking[];
  blockedExperienceIds: string[];
  totalGuests: number;
  onBookingClick?: (_bookingId: string) => void;
  onRefresh?: () => void;
}

const dateLocales = { fr, de, en: enUS };

export function DayDetailPanel({
  open,
  onOpenChange,
  date,
  bookings,
  blockedExperienceIds,
  totalGuests,
  onBookingClick,
  onRefresh,
}: DayDetailPanelProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const dateLocale = dateLocales[locale as keyof typeof dateLocales] || enUS;
  const [isBlocking, setIsBlocking] = useState(false);
  const isFullyBlocked = blockedExperienceIds.length > 0;

  const handleBlockDate = async () => {
    setIsBlocking(true);
    try {
      const result = await blockDateForAllExperiences(date);
      if (result.success) {
        toast.success(t('blockedSuccess', { count: result.data?.blockedCount || 0, date: format(date, 'PPP', { locale: dateLocale }) }));
        onRefresh?.();
      } else {
        toast.error(result.error?.message || t('blockError'));
      }
    } catch {
      toast.error(t('blockError'));
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockDate = async () => {
    setIsBlocking(true);
    try {
      const result = await unblockDateForAllExperiences(date);
      if (result.success) {
        toast.success(t('unblockedSuccess', { count: result.data?.unblockedCount || 0, date: format(date, 'PPP', { locale: dateLocale }) }));
        onRefresh?.();
      } else {
        toast.error(result.error?.message || t('unblockError'));
      }
    } catch {
      toast.error(t('unblockError'));
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{format(date, 'PPPP', { locale: dateLocale })}</span>
            {isFullyBlocked && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {t('blocked')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{bookings.length}</span>
              {t('bookingsCount', { count: bookings.length })}
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4" />
              <span className="font-semibold text-slate-900">{totalGuests}</span>
              {t('guestsCount', { count: totalGuests })}
            </div>
          </div>

          {/* Block/Unblock Date */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div className="text-sm">
              {isFullyBlocked ? (
                <span className="text-slate-600">{t('dateBlockedMessage')}</span>
              ) : (
                <span className="text-slate-600">{t('blockDateQuestion')}</span>
              )}
            </div>
            <Button
              variant={isFullyBlocked ? 'outline' : 'destructive'}
              size="sm"
              onClick={isFullyBlocked ? handleUnblockDate : handleBlockDate}
              disabled={isBlocking}
            >
              {isBlocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFullyBlocked ? (
                <>
                  <X className="mr-1.5 h-4 w-4" />
                  {t('unblock')}
                </>
              ) : (
                <>
                  <Ban className="mr-1.5 h-4 w-4" />
                  {t('blockDate')}
                </>
              )}
            </Button>
          </div>

          {/* Bookings List */}
          {bookings.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-700">{t('bookingsTitle')}</h3>
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onBookingClick?.(booking.id)}
                    className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ExperienceTypeDot type={booking.experience.type} size="sm" />
                          <span className="font-medium text-slate-900">
                            {booking.experience.title}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600">
                          {booking.visitorName}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.timeSlot}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {t('guestsCount', { count: booking.guestCount })}
                          </div>
                          <span>{formatCHF(booking.totalPrice)}</span>
                        </div>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">
              {t('noBookings')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
