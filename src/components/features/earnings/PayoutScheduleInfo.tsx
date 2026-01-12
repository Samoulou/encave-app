import { Info } from 'lucide-react';

export function PayoutScheduleInfo() {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4">
      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <div className="text-sm text-blue-900">
        <p className="font-medium">Payout Schedule</p>
        <p className="mt-1 text-blue-700">
          Payouts are processed automatically 7 days after the experience date.
          Funds are transferred directly to your connected bank account via Stripe.
        </p>
      </div>
    </div>
  );
}
