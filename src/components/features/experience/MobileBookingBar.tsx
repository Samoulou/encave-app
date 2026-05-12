'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { MobileBookingDrawer } from './MobileBookingDrawer';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface MobileBookingBarProps {
  price: number;
  experienceSlug: string;
  experienceId: string;
  stripeConnected: boolean;
  minCapacity: number;
  maxCapacity: number;
  duration: number;
  availabilitySlots?: AvailabilitySlot[];
}

export function MobileBookingBar({
  price,
  experienceSlug,
  experienceId,
  stripeConnected,
  minCapacity,
  maxCapacity,
  duration,
  availabilitySlots = [],
}: MobileBookingBarProps) {
  const t = useTranslations('booking');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isBookingEnabled = stripeConnected;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-4 shadow-warm-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <span className="text-lg font-bold text-foreground">
              {formatCHF(price)}
            </span>
            <span className="ml-1 text-sm text-gray-500">
              / {t('perPerson')}
            </span>
          </div>
          {isBookingEnabled ? (
            <Button
              className="hover:bg-primary-hover bg-primary px-6 font-bold text-white"
              onClick={() => setIsDrawerOpen(true)}
            >
              {t('bookNow')}
            </Button>
          ) : (
            <Button
              className="bg-primary px-6 font-bold text-white opacity-90"
              disabled
            >
              {t('bookNow')}
            </Button>
          )}
        </div>
      </div>

      {isBookingEnabled && (
        <MobileBookingDrawer
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          price={price}
          experienceSlug={experienceSlug}
          experienceId={experienceId}
          minCapacity={minCapacity}
          maxCapacity={maxCapacity}
          duration={duration}
          availabilitySlots={availabilitySlots}
        />
      )}
    </>
  );
}
