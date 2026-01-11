'use client';

import { useTranslations } from 'next-intl';
import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generateGoogleCalendarUrl,
  downloadICalEvent,
  createBookingCalendarEvent,
} from '@/lib/utils/calendar';

interface AddToCalendarProps {
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
  };
}

export function AddToCalendar({ booking }: AddToCalendarProps) {
  const t = useTranslations('confirmation');

  const calendarEvent = createBookingCalendarEvent({
    ...booking,
    bookingUrl: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  const handleGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl(calendarEvent);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadIcal = () => {
    downloadICalEvent(calendarEvent, `encave-booking-${booking.reference}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGoogleCalendar}
        className="flex items-center gap-2"
      >
        <CalendarPlus className="h-4 w-4" />
        {t('addToGoogleCalendar')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadIcal}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        {t('downloadIcal')}
      </Button>
    </div>
  );
}
