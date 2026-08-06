import { AlertCircle } from 'lucide-react';

interface HoldCapacityErrorProps {
  /** Translated NO_CAPACITY message (`booking.holdSlotTaken`). */
  message: string;
}

/**
 * Inline "slot just got taken" banner shown next to the « Continuer »
 * button when `createBookingHold` returns NO_CAPACITY (P-04 / L-050).
 * Shared by BookingWidget and MobileBookingDrawer.
 */
export function HoldCapacityError({ message }: HoldCapacityErrorProps) {
  return (
    <div
      role="alert"
      data-testid="hold-capacity-error"
      className="mb-3 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
