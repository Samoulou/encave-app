'use client';

import { useTranslations } from 'next-intl';
import { Calendar, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  downloadICalEvent,
  createBookingCalendarEvent,
} from '@/lib/utils/calendar';

interface ConfirmationActionsProps {
  booking: {
    experienceTitle: string;
    wineryName: string;
    wineryAddress: string;
    wineryCommune: string;
    date: Date;
    timeSlot: string;
    durationMinutes: number;
    guestCount: number;
    reference: string;
    id: string;
  };
}

export function ConfirmationActions({ booking }: ConfirmationActionsProps) {
  const t = useTranslations('confirmation');

  const calendarEvent = createBookingCalendarEvent({
    ...booking,
    bookingUrl:
      typeof window !== 'undefined' ? window.location.href : undefined,
  });

  const handleAddToCalendar = () => {
    downloadICalEvent(calendarEvent, `encave-booking-${booking.reference}`);
  };

  const handleDownloadReceipt = () => {
    // For now, open a print dialog as a fallback
    // In a full implementation, this would generate a PDF
    window.print();
  };

  return (
    <div className="mt-2 flex flex-col gap-4 sm:flex-row">
      <Button onClick={handleAddToCalendar} className="h-12 flex-1" size="lg">
        <Calendar className="mr-2 size-5" />
        {t('addToCalendar')}
      </Button>
      <Button
        onClick={handleDownloadReceipt}
        variant="outline"
        className="h-12 flex-1"
        size="lg"
      >
        <Receipt className="mr-2 size-5" />
        {t('downloadReceipt')}
      </Button>
    </div>
  );
}
