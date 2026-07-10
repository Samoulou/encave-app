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
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge } from '@/components/features/booking/BookingStatusBadge';
import { cancelClientBooking } from '@/server/actions/client.actions';
import type { ClientBookingWithDetails } from '@/server/queries/client-booking.queries';
import type { BookingStatus } from '@prisma/client';

interface ClientBookingCardProps {
  booking: ClientBookingWithDetails;
  variant: 'upcoming' | 'past';
}

export function ClientBookingCard({
  booking,
  variant,
}: ClientBookingCardProps) {
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

  const formattedDate = formatDate(new Date(booking.date), locale as Locale, {
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
    <div className="rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Summary Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-4 rounded-xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6"
        aria-expanded={isExpanded}
      >
        {/* Cover Photo */}
        <div className="relative hidden h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg sm:block">
          <Image
            src={booking.experience.coverPhoto}
            alt={booking.experience.title}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display font-bold text-foreground">
              {booking.experience.title}
            </h3>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.winery.name} &middot; {formattedDate} &middot;{' '}
            {booking.timeSlot}
          </p>
        </div>

        {/* Expand Icon */}
        <div className="flex-shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-4 border-t border-border p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">
                  {booking.timeSlot} &middot; {booking.experience.duration} min
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">
                  {t('bookingCard.guests', { count: booking.guestCount })}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {t('bookingCard.reference')}:{' '}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {booking.reference}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {t('bookingCard.price')}:{' '}
                </span>
                <span className="font-bold text-foreground">
                  CHF {priceFormatted}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">
                {t('bookingCard.winery')}
              </h4>
              <div className="flex items-start gap-2 text-sm">
                <MapPin
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">
                  {booking.winery.address}
                  {booking.winery.commune && `, ${booking.winery.commune}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <a
                  href={`tel:${booking.winery.phone}`}
                  className="text-primary hover:underline"
                >
                  {booking.winery.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
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
                  ? 'border border-green-200 bg-green-50 text-green-800'
                  : 'border border-red-200 bg-red-50 text-red-800'
              )}
            >
              {cancelResult.success
                ? cancelResult.refundIssued
                  ? t('cancel.successWithRefund', {
                      amount: ((cancelResult.refundAmount ?? 0) / 100).toFixed(
                        2
                      ),
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
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary/90"
            >
              {t('bookingCard.bookAgain')}
            </Link>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">
                {t('cancel.title')}
              </h3>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('cancel.confirmMessage', { title: booking.experience.title })}
            </p>

            <div className="rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-bold text-foreground">
                {t('cancel.refundPolicy')}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t('cancel.refundPolicyDetail')}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setShowCancelDialog(false)}
                disabled={isPending}
              >
                {t('cancel.keepBooking')}
              </Button>
              <Button
                className="h-11 bg-red-600 text-white hover:bg-red-700"
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
