'use client';

import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { Mail, Phone, History, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookingStatusBadge } from './BookingStatusBadge';
import { getClientHistory } from '@/server/actions/booking-dashboard';

interface ClientBooking {
  id: string;
  reference: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  status: BookingStatus;
  experience: { title: string };
}

interface ClientDetailsModalProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
}

export function ClientDetailsModal({
  open,
  onOpenChange,
  visitorName,
  visitorEmail,
  visitorPhone,
}: ClientDetailsModalProps) {
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && visitorEmail) {
      startTransition(async () => {
        const result = await getClientHistory(visitorEmail);
        if (result.success) {
          setBookings(result.data.bookings);
          setError(null);
        } else {
          setError(result.error.message);
          setBookings([]);
        }
      });
    }
  }, [open, visitorEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{visitorName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">
              Contact Information
            </h3>
            <div className="space-y-2">
              <a
                href={`mailto:${visitorEmail}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-600"
              >
                <Mail className="h-4 w-4" />
                {visitorEmail}
              </a>
              <a
                href={`tel:${visitorPhone}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-600"
              >
                <Phone className="h-4 w-4" />
                {visitorPhone}
              </a>
            </div>
          </div>

          {/* Booking History */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <History className="h-4 w-4" />
              Booking History
            </h3>

            {isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-slate-500">No previous bookings</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {booking.experience.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(booking.date), 'MMM d, yyyy')} at{' '}
                          {booking.timeSlot}
                        </p>
                        <p className="text-xs text-slate-500">
                          {booking.guestCount} guest
                          {booking.guestCount !== 1 ? 's' : ''} &middot; CHF{' '}
                          {(booking.totalPrice / 100).toFixed(2)}
                        </p>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
