'use client';

import { useState, useTransition } from 'react';
import { BookingStatus } from '@prisma/client';
import { MoreHorizontal, CheckCircle, XCircle, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  markBookingCompleted,
  markBookingNoShow,
} from '@/server/actions/booking-dashboard';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface BookingQuickActionsProps {
  bookingId: string;
  status: BookingStatus;
  date: Date;
  timeSlot: string;
  visitorEmail: string;
  onViewClient: () => void;
}

export function BookingQuickActions({
  bookingId,
  status,
  date,
  timeSlot,
  onViewClient,
}: BookingQuickActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Check if booking is in the past
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const bookingDateTime = new Date(date);
  bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  const isPast = bookingDateTime < new Date();

  // Can only update confirmed bookings that are in the past
  const canUpdateStatus = status === BookingStatus.CONFIRMED && isPast;

  const handleMarkCompleted = () => {
    setPendingAction('completed');
    startTransition(async () => {
      const result = await markBookingCompleted(bookingId);
      if (result.success) {
        toast.success('Booking marked as completed');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
      setPendingAction(null);
    });
  };

  const handleMarkNoShow = () => {
    setPendingAction('no-show');
    startTransition(async () => {
      const result = await markBookingNoShow(bookingId);
      if (result.success) {
        toast.success('Booking marked as no-show');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
      setPendingAction(null);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onViewClient}>
          <User className="mr-2 h-4 w-4" />
          View Client
        </DropdownMenuItem>

        {canUpdateStatus && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleMarkCompleted}
              disabled={pendingAction === 'completed'}
            >
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
              Mark as Completed
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleMarkNoShow}
              disabled={pendingAction === 'no-show'}
              className="text-red-600 focus:text-red-600"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Mark as No-Show
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
