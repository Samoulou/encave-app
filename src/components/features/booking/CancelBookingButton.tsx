'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CancellationModal } from './CancellationModal';

interface CancelBookingButtonProps {
  bookingId: string;
  accessToken: string;
  totalPrice: number;
}

export function CancelBookingButton({
  bookingId,
  accessToken,
  totalPrice,
}: CancelBookingButtonProps) {
  const t = useTranslations('cancellation');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsModalOpen(true)}
        className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
      >
        <XCircle className="mr-2 h-4 w-4" />
        {t('cancelBooking')}
      </Button>

      <CancellationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bookingId={bookingId}
        accessToken={accessToken}
        totalPrice={totalPrice}
      />
    </>
  );
}
