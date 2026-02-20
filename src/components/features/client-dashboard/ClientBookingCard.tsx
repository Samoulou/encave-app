'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Mail,
  Clock,
  Users,
  Calendar,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/features/booking/dashboard/BookingStatusBadge';
import { cancelClientBooking } from '@/server/actions/client.actions';
import type { ClientBookingWithDetails } from '@/server/queries/client-booking.queries';
import type { BookingStatus } from '@prisma/client';

interface ClientBookingCardProps {
  booking: ClientBookingWithDetails;
  variant: 'upcoming' | 'past';
}

export function ClientBookingCard({ booking, variant }: ClientBookingCardProps) {
  const locale = useLocale();
  const t = useTranslations('clientDashboard');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cancelResult, setCancelResult] = useState<{
    success: boolean;
    message?: string;
    refundIssued?: boolean;
    refundAmount?: number | null;
  } | null>(null);

  const formattedDate = new Date(booking.date).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const priceFormatted = (booking.totalPrice / 100).toFixed(2);

  const canCancel =
    variant === 'upcoming' && booking.status === ('CONFIRMED' as BookingStatus);

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelClientBooking(booking.id);
      if (result.success) {
        setCancelResult({
          success: true,
          refundIssued: result.data.refundIssued,
          refundAmount: result.data.refundAmount,
        });
      } else {
        setCancelResult({
          success: false,
          message: result.error.message,
        });
      }
      setShowCancelDialog(false);
    });
  }

  return (
    <div className="rounded-xl border border-[#e5d2d7] bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Summary Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-6 flex items-center gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        aria-expanded={isExpanded}
      >
        {/* Cover Photo */}
        <div className="hidden sm:block relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={booking.experience.coverPhoto}
            alt={booking.experience.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-[#1a0f12] truncate">
              {booking.experience.title}
            </h3>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-[#915564] mt-1">
            {booking.winery.name} &middot; {formattedDate} &middot; {booking.timeSlot}
          </p>
        </div>

        {/* Expand Icon */}
        <div className="flex-shrink-0 text-[#915564]">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-[#e5d2d7] p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-[#915564]" aria-hidden="true" />
                <span className="text-[#1a0f12]">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-[#915564]" aria-hidden="true" />
                <span className="text-[#1a0f12]">
                  {booking.timeSlot} &middot; {booking.experience.duration} min
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-[#915564]" aria-hidden="true" />
                <span className="text-[#1a0f12]">
                  {t('bookingCard.guests', { count: booking.guestCount })}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-[#915564]">{t('bookingCard.reference')}: </span>
                <span className="font-mono font-bold text-[#1a0f12]">
                  {booking.reference}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-[#915564]">{t('bookingCard.price')}: </span>
                <span className="font-bold text-[#1a0f12]">CHF {priceFormatted}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[#1a0f12]">
                {t('bookingCard.winery')}
              </h4>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-[#915564] mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="text-[#1a0f12]">
                  {booking.winery.address}
                  {booking.winery.commune && `, ${booking.winery.commune}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-[#915564]" aria-hidden="true" />
                <a
                  href={`tel:${booking.winery.phone}`}
                  className="text-primary hover:underline"
                >
                  {booking.winery.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-[#915564]" aria-hidden="true" />
                <a
                  href={`mailto:${booking.winery.email}`}
                  className="text-primary hover:underline"
                >
                  {booking.winery.email}
                </a>
              </div>
            </div>
          </div>

          {/* Cancel result message */}
          {cancelResult && (
            <div
              className={cn(
                'rounded-lg p-3 text-sm',
                cancelResult.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              )}
            >
              {cancelResult.success
                ? cancelResult.refundIssued
                  ? t('cancel.successWithRefund', {
                      amount: ((cancelResult.refundAmount ?? 0) / 100).toFixed(2),
                    })
                  : t('cancel.successNoRefund')
                : cancelResult.message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            {canCancel && !cancelResult?.success && (
              <Button
                variant="outline"
                className="h-11 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setShowCancelDialog(true)}
                disabled={isPending}
              >
                {t('bookingCard.cancel')}
              </Button>
            )}
            <Link
              href={`/${locale}/experiences/${booking.experience.slug}`}
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
            >
              {t('bookingCard.bookAgain')}
            </Link>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-[#1a0f12]">
                {t('cancel.title')}
              </h3>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-[#915564]">
              {t('cancel.confirmMessage', { title: booking.experience.title })}
            </p>

            <div className="rounded-lg bg-[#fdfcfa] border border-[#e5d2d7] p-3 text-sm">
              <p className="font-bold text-[#1a0f12]">{t('cancel.refundPolicy')}</p>
              <p className="text-[#915564] mt-1">{t('cancel.refundPolicyDetail')}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setShowCancelDialog(false)}
                disabled={isPending}
              >
                {t('cancel.keepBooking')}
              </Button>
              <Button
                className="h-11 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancel}
                disabled={isPending}
              >
                {isPending ? t('cancel.cancelling') : t('cancel.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
