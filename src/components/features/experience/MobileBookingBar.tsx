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
  availabilitySlots?: AvailabilitySlot[];
}

export function MobileBookingBar({
  price,
  experienceSlug,
  experienceId,
  stripeConnected,
  minCapacity,
  maxCapacity,
  availabilitySlots = [],
}: MobileBookingBarProps) {
  const t = useTranslations('booking');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isBookingEnabled = stripeConnected;

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-warm-xl z-40">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <span className="text-lg font-bold text-foreground">
              {formatCHF(price)}
            </span>
            <span className="text-sm text-gray-500 ml-1">
              / {t('perPerson')}
            </span>
          </div>
          {isBookingEnabled ? (
            <Button
              className="bg-primary hover:bg-[#b02245] text-white font-bold px-6"
              onClick={() => setIsDrawerOpen(true)}
            >
              {t('bookNow')}
            </Button>
          ) : (
            <Button
              className="bg-primary text-white font-bold px-6 opacity-90"
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
          availabilitySlots={availabilitySlots}
        />
      )}
    </>
  );
}
