'use client';

import { useState, useMemo, memo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookingStatus } from '@prisma/client';
import { MoreVertical, Check, X, Users, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { BookingStatusBadge } from './BookingStatusBadge';
import { ClientDetailsModal } from './ClientDetailsModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { approveBooking, rejectBooking } from '@/server/actions/booking-dashboard';
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
 * Features: Avatar with initials fallback, inline approve/reject for pending,
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

  const handleApprove = async (bookingId: string) => {
    setPendingAction(`approve-${bookingId}`);
    startTransition(async () => {
      try {
        const result = await approveBooking(bookingId);
        if (result.success) {
          toast.success(t('toast.confirmed'));
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error(t('toast.approveFailed'));
      } finally {
        setPendingAction(null);
      }
    });
  };

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
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label={t('tableLabel')}>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564]">
                  {t('columns.bookingInfo')}
                </th>
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564]">
                  {t('columns.client')}
                </th>
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564]">
                  {t('columns.experience')}
                </th>
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564]">
                  {t('columns.guests')}
                </th>
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564]">
                  {t('columns.status')}
                </th>
                <th scope="col" className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-[#915564] text-right">
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2e9eb]">
              {paginatedBookings.map((booking) => {
                const bookingDate = new Date(booking.date);
                const isPendingStatus = booking.status === BookingStatus.PENDING_PAYMENT;
                const initials = getInitials(booking.visitorName);
                const isApproving = pendingAction === `approve-${booking.id}`;
                const isRejecting = pendingAction === `reject-${booking.id}`;

                return (
                  <tr key={booking.id} className="group hover:bg-[#fbf9f9] transition-colors">
                    {/* Booking Info */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-foreground font-bold text-sm">
                          {formatDate(bookingDate, locale as Locale, { dateStyle: 'medium' })}
                        </span>
                        <span className="text-[#915564] text-xs">
                          {booking.timeSlot}
                        </span>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-foreground text-sm font-semibold truncate">
                            {booking.visitorName}
                          </span>
                          <span className="text-[#915564] text-xs truncate">
                            {booking.visitorEmail}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Experience */}
                    <td className="py-4 px-6">
                      <span className="text-foreground text-sm font-medium">
                        {booking.experience.title}
                      </span>
                    </td>

                    {/* Guests */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1 text-foreground text-sm">
                        <Users className="h-4 w-4 text-[#915564]" />
                        {t('guestCount', { count: booking.guestCount })}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <BookingStatusBadge status={booking.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      {isPendingStatus ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(booking.id)}
                            disabled={isApproving || isRejecting}
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                            title={t('actions.approve')}
                            aria-label={t('actions.approve')}
                          >
                            {isApproving ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Check className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(booking.id)}
                            disabled={isApproving || isRejecting}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
                            <button className="p-2 rounded-lg text-[#915564] hover:bg-primary-light hover:text-primary transition-colors" aria-label={t('actions.moreOptions')}>
                              <MoreVertical className="h-5 w-5" aria-hidden="true" />
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
        <div className="bg-white px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-[#915564]">
            {t('pagination.showing', { from: startIndex + 1, to: endIndex, total: bookings.length })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg border border-border text-[#915564] text-sm hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('pagination.previousPage')}
            >
              {t('pagination.previous')}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg border border-border text-[#915564] text-sm hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
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
