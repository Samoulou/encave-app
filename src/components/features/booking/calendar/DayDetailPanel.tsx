'use client';

import { useState } from 'react';
import { format } from 'date-fns';
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
  const [isBlocking, setIsBlocking] = useState(false);
  const isFullyBlocked = blockedExperienceIds.length > 0;

  const handleBlockDate = async () => {
    setIsBlocking(true);
    try {
      const result = await blockDateForAllExperiences(date);
      if (result.success) {
        toast.success(`Blocked ${result.data?.blockedCount || 0} experiences for ${format(date, 'MMMM d, yyyy')}`);
        onRefresh?.();
      } else {
        toast.error(result.error?.message || 'Failed to block date');
      }
    } catch {
      toast.error('Failed to block date');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockDate = async () => {
    setIsBlocking(true);
    try {
      const result = await unblockDateForAllExperiences(date);
      if (result.success) {
        toast.success(`Unblocked ${result.data?.unblockedCount || 0} experiences for ${format(date, 'MMMM d, yyyy')}`);
        onRefresh?.();
      } else {
        toast.error(result.error?.message || 'Failed to unblock date');
      }
    } catch {
      toast.error('Failed to unblock date');
    } finally {
      setIsBlocking(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(cents / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
            {isFullyBlocked && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Blocked
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{bookings.length}</span>
              bookings
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4" />
              <span className="font-semibold text-slate-900">{totalGuests}</span>
              guests
            </div>
          </div>

          {/* Block/Unblock Date */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div className="text-sm">
              {isFullyBlocked ? (
                <span className="text-slate-600">This date is blocked for bookings</span>
              ) : (
                <span className="text-slate-600">Block this date for all experiences?</span>
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
                  Unblock
                </>
              ) : (
                <>
                  <Ban className="mr-1.5 h-4 w-4" />
                  Block Date
                </>
              )}
            </Button>
          </div>

          {/* Bookings List */}
          {bookings.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-700">Bookings</h3>
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
                            {booking.guestCount} guests
                          </div>
                          <span>{formatPrice(booking.totalPrice)}</span>
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
              No bookings for this day
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
