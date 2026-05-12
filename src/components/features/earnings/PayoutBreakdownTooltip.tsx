'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCHF } from '@/lib/utils/currency';

interface PayoutBreakdownTooltipProps {
  children: React.ReactNode;
  grossAmount: number;
  platformFee: number;
  netPayout: number;
  feePercentage?: number;
}

export function PayoutBreakdownTooltip({
  children,
  grossAmount,
  platformFee,
  netPayout,
  feePercentage = 12,
}: PayoutBreakdownTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs border bg-white p-3 text-slate-900 shadow-lg">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Gross:</span>
            <span className="font-medium">{formatCHF(grossAmount)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">
              Platform Fee ({feePercentage}%):
            </span>
            <span className="font-medium text-red-600">
              -{formatCHF(platformFee)}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-1.5">
            <div className="flex justify-between gap-4">
              <span className="font-medium text-slate-900">Your Payout:</span>
              <span className="font-semibold text-emerald-600">
                {formatCHF(netPayout)}
              </span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
