'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Calendar, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  downloadICalEvent,
  createBookingCalendarEvent,
} from '@/lib/utils/calendar';
import { exportBookingReceiptPDF } from '@/server/actions/booking-receipt';

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
  const searchParams = useSearchParams();
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  const calendarEvent = createBookingCalendarEvent({
    ...booking,
    bookingUrl:
      typeof window !== 'undefined' ? window.location.href : undefined,
  });

  const handleAddToCalendar = () => {
    downloadICalEvent(calendarEvent, `encave-booking-${booking.reference}`);
  };

  const handleDownloadReceipt = async () => {
    setIsDownloadingReceipt(true);
    try {
      const result = await exportBookingReceiptPDF(
        booking.id,
        searchParams?.get('session_id') ?? null
      );

      if (!result.success) {
        toast.error(result.error?.message ?? 'Unable to generate receipt.');
        return;
      }

      const byteCharacters = atob(result.data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Unable to generate receipt.');
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-4 sm:flex-row">
      <Button
        onClick={handleAddToCalendar}
        className="min-h-12 flex-1 whitespace-normal"
        size="lg"
      >
        <Calendar className="mr-2 size-5 shrink-0" />
        <span>{t('addToCalendar')}</span>
      </Button>
      <Button
        onClick={handleDownloadReceipt}
        variant="outline"
        className="min-h-12 flex-1 whitespace-normal"
        size="lg"
        disabled={isDownloadingReceipt}
      >
        {isDownloadingReceipt ? (
          <Loader2 className="mr-2 size-5 shrink-0 animate-spin" />
        ) : (
          <Receipt className="mr-2 size-5 shrink-0" />
        )}
        <span>{t('downloadReceipt')}</span>
      </Button>
    </div>
  );
}
