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
    bookingUrl: typeof window !== 'undefined' ? window.location.href : undefined,
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
    <div className="flex flex-col sm:flex-row gap-4 mt-2">
      <Button
        onClick={handleAddToCalendar}
        className="flex-1 h-12"
        size="lg"
      >
        <Calendar className="size-5 mr-2" />
        {t('addToCalendar')}
      </Button>
      <Button
        onClick={handleDownloadReceipt}
        variant="outline"
        className="flex-1 h-12"
        size="lg"
      >
        <Receipt className="size-5 mr-2" />
        {t('downloadReceipt')}
      </Button>
    </div>
  );
}
