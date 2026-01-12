'use client';

import { useState } from 'react';
import { useQueryState } from 'nuqs';
import { format } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from './BookingStatusBadge';
import { BookingRowExpanded } from './BookingRowExpanded';
import { BookingQuickActions } from './BookingQuickActions';
import { ClientDetailsModal } from './ClientDetailsModal';

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

type SortField = 'date' | 'totalPrice' | 'guestCount';

export function BookingsTable({ bookings }: BookingsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [clientModalData, setClientModalData] = useState<{
    name: string;
    email: string;
    phone: string;
  } | null>(null);

  const [sortField, setSortField] = useQueryState('sort', {
    defaultValue: 'date',
    shallow: false,
  });
  const [sortOrder, setSortOrder] = useQueryState('order', {
    defaultValue: 'asc',
    shallow: false,
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700"
    >
      {children}
      <ArrowUpDown
        className={cn('h-3 w-3', sortField === field && 'text-burgundy-600')}
      />
    </button>
  );

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Table Header */}
        <div className="hidden border-b border-slate-200 bg-slate-50 px-6 py-3 md:grid md:grid-cols-[1fr_100px_1.2fr_1fr_80px_100px_100px_48px]">
          <SortButton field="date">Date</SortButton>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Time
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Experience
          </span>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Client
          </span>
          <SortButton field="guestCount">Guests</SortButton>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Status
          </span>
          <SortButton field="totalPrice">Amount</SortButton>
          <span className="sr-only">Actions</span>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-200">
          {bookings.map((booking) => {
            const isExpanded = expandedRows.has(booking.id);
            const bookingDate = new Date(booking.date);

            return (
              <div key={booking.id} className="group">
                {/* Main Row */}
                <div
                  className={cn(
                    'cursor-pointer px-6 py-4 transition-colors hover:bg-slate-50',
                    isExpanded && 'bg-slate-50'
                  )}
                  onClick={() => toggleRow(booking.id)}
                >
                  {/* Desktop Layout */}
                  <div className="hidden items-center md:grid md:grid-cols-[1fr_100px_1.2fr_1fr_80px_100px_100px_48px]">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="text-sm font-medium text-slate-900">
                        {format(bookingDate, 'MMM d, yyyy')}
                      </span>
                    </div>
                    <span className="text-sm text-slate-600">
                      {booking.timeSlot}
                    </span>
                    <span className="truncate text-sm text-slate-900">
                      {booking.experience.title}
                    </span>
                    <span className="truncate text-sm text-slate-600">
                      {booking.visitorName}
                    </span>
                    <span className="text-sm text-slate-600">
                      {booking.guestCount}
                    </span>
                    <BookingStatusBadge status={booking.status} />
                    <span className="text-sm font-medium text-slate-900">
                      CHF {(booking.totalPrice / 100).toFixed(2)}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <BookingQuickActions
                        bookingId={booking.id}
                        status={booking.status}
                        date={booking.date}
                        timeSlot={booking.timeSlot}
                        visitorEmail={booking.visitorEmail}
                        onViewClient={() =>
                          setClientModalData({
                            name: booking.visitorName,
                            email: booking.visitorEmail,
                            phone: booking.visitorPhone,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {isExpanded ? (
                          <ChevronUp className="mt-0.5 h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="mt-0.5 h-4 w-4 text-slate-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {booking.experience.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(bookingDate, 'MMM d, yyyy')} at{' '}
                            {booking.timeSlot}
                          </p>
                          <p className="text-xs text-slate-500">
                            {booking.visitorName} &middot; {booking.guestCount}{' '}
                            guest{booking.guestCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900">
                            CHF {(booking.totalPrice / 100).toFixed(2)}
                          </p>
                          <BookingStatusBadge status={booking.status} />
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <BookingQuickActions
                            bookingId={booking.id}
                            status={booking.status}
                            date={booking.date}
                            timeSlot={booking.timeSlot}
                            visitorEmail={booking.visitorEmail}
                            onViewClient={() =>
                              setClientModalData({
                                name: booking.visitorName,
                                email: booking.visitorEmail,
                                phone: booking.visitorPhone,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <BookingRowExpanded
                    visitorEmail={booking.visitorEmail}
                    visitorPhone={booking.visitorPhone}
                    reference={booking.reference}
                  />
                )}
              </div>
            );
          })}
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
