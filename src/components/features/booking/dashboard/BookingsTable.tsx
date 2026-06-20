'use client';

import { useState, useMemo, memo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookingStatus } from '@prisma/client';
import { MoreVertical, X, Users, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { BookingStatusBadge } from '@/components/features/booking/BookingStatusBadge';
import { ClientDetailsModal } from './ClientDetailsModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { rejectBooking } from '@/server/actions/booking-dashboard';
import { toast } from 'sonner';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import { getInitials } from '@/lib/get-initials';

interface BookingWithExperience {
  id: string;
  reference: string;
  visitorEmail: string;
  visitorName: string;
  visitorPhone: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  wineryPayout: number;
  status: BookingStatus;
  experience: {
    id: string;
    title: string;
    slug: string;
  };
}

interface BookingsTableProps {
  bookings: BookingWithExperience[];
}

const DEFAULT_PAGE_SIZE = 5;

/**
 * Bookings table component matching US-UI-09 mockup.
 * Features: Avatar with initials fallback, inline reject for pending payments,
 * context menu for other statuses, and simplified pagination.
 */
function BookingsTableComponent({ bookings }: BookingsTableProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('bookings');
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [clientModalData, setClientModalData] = useState<{
    name: string;
    email: string;
    phone: string;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  // Calculate paginated data
  const totalPages = Math.ceil(bookings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, bookings.length);
  const paginatedBookings = useMemo(() => {
    return bookings.slice(startIndex, startIndex + pageSize);
  }, [bookings, startIndex, pageSize]);

  // Reset to page 1 when bookings change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleReject = async (bookingId: string) => {
    setPendingAction(`reject-${bookingId}`);
    startTransition(async () => {
      try {
        const result = await rejectBooking(bookingId);
        if (result.success) {
          toast.success(t('toast.rejected'));
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error(t('toast.rejectFailed'));
      } finally {
        setPendingAction(null);
      }
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Table */}
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left"
            aria-label={t('tableLabel')}
          >
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.bookingInfo')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.client')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.experience')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.guests')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.status')}
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2e9eb]">
              {paginatedBookings.map((booking) => {
                const bookingDate = new Date(booking.date);
                const isPendingStatus =
                  booking.status === BookingStatus.PENDING_PAYMENT;
                const initials = getInitials(booking.visitorName);
                const isRejecting = pendingAction === `reject-${booking.id}`;

                return (
                  <tr
                    key={booking.id}
                    className="group transition-colors hover:bg-[#fbf9f9]"
                  >
                    {/* Booking Info */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">
                          {formatDate(bookingDate, locale as Locale, {
                            dateStyle: 'medium',
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {booking.timeSlot}
                        </span>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {initials}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {booking.visitorName}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {booking.visitorEmail}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Experience */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">
                        {booking.experience.title}
                      </span>
                    </td>

                    {/* Guests */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-foreground">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {t('guestCount', { count: booking.guestCount })}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <BookingStatusBadge status={booking.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {isPendingStatus ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={isRejecting}
                            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                            title={t('actions.reject')}
                            aria-label={t('actions.reject')}
                          >
                            {isRejecting ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <X className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary-light hover:text-primary"
                              aria-label={t('actions.moreOptions')}
                            >
                              <MoreVertical
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() =>
                                setClientModalData({
                                  name: booking.visitorName,
                                  email: booking.visitorEmail,
                                  phone: booking.visitorPhone,
                                })
                              }
                            >
                              {t('actions.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `mailto:${booking.visitorEmail}`;
                              }}
                            >
                              {t('actions.contactClient')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border bg-white px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: startIndex + 1,
              to: endIndex,
              total: bookings.length,
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('pagination.previousPage')}
            >
              {t('pagination.previous')}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('pagination.nextPage')}
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Client Details Modal */}
      <ClientDetailsModal
        open={clientModalData !== null}
        onOpenChange={(open) => !open && setClientModalData(null)}
        visitorName={clientModalData?.name ?? ''}
        visitorEmail={clientModalData?.email ?? ''}
        visitorPhone={clientModalData?.phone ?? ''}
      />
    </>
  );
}

// Memoized export to prevent unnecessary re-renders
export const BookingsTable = memo(BookingsTableComponent);
