'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingCTAProps {
  price: number;
}

function formatPrice(priceInCents: number): string {
  return `CHF ${(priceInCents / 100).toFixed(0)}`;
}

export function BookingCTA({ price }: BookingCTAProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="rounded-xl bg-white p-6 shadow-warm">
      {/* Price */}
      <div className="text-center">
        <p className="text-3xl font-bold text-slate-900">{formatPrice(price)}</p>
        <p className="text-sm text-slate-500">per person</p>
      </div>

      {/* CTA Button with Tooltip */}
      <div className="relative mt-6">
        <Button
          size="lg"
          className="w-full"
          disabled
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Book This Experience
        </Button>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
            role="tooltip"
          >
            Booking coming soon!
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900" />
          </div>
        )}
      </div>

      {/* Coming Soon Badge */}
      <div className="mt-4 rounded-lg border-2 border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-gold-100/50 p-4 text-center">
        <p className="text-sm font-medium text-gold-900">
          Online booking coming soon!
        </p>
        <p className="mt-1 text-xs text-gold-700">
          Contact the winery directly to book this experience.
        </p>
      </div>
    </div>
  );
}
