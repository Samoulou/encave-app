'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';

interface MobileBookingBarProps {
  price: number;
  experienceSlug: string;
  stripeConnected: boolean;
}

export function MobileBookingBar({
  price,
  experienceSlug,
  stripeConnected,
}: MobileBookingBarProps) {
  const t = useTranslations('booking');
  const isBookingEnabled = stripeConnected;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgb(0,0,0,0.1)] z-40">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div>
          <span className="text-lg font-bold text-[#1a0f12]">
            {formatCHF(price)}
          </span>
          <span className="text-sm text-gray-500 ml-1">
            / {t('perPerson')}
          </span>
        </div>
        {isBookingEnabled ? (
          <Button
            className="bg-primary hover:bg-[#b02245] text-white font-bold px-6"
            asChild
          >
            <Link href={`/experiences/${experienceSlug}/book`}>
              {t('bookNow')}
            </Link>
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
  );
}
