'use client';

import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStripeDashboardLink } from '@/server/actions/stripe';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PaymentStatusType } from '@/lib/utils/payment-status';

interface PaymentStatusProps {
  status: PaymentStatusType;
  className?: string;
}

const statusConfig = {
  not_connected: {
    label: 'Not connected',
    description: 'Connect your bank account to receive payments',
    icon: XCircle,
    iconColor: 'text-slate-400',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
  },
  pending: {
    label: 'Pending verification',
    description: 'Stripe is verifying your account details',
    icon: Clock,
    iconColor: 'text-gold-500',
    bgColor: 'bg-gold-50',
    textColor: 'text-gold-700',
  },
  ready: {
    label: 'Ready to accept payments',
    description: 'Your account is fully set up',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
};

export function PaymentStatus({ status, className }: PaymentStatusProps) {
  const [isLoading, setIsLoading] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleOpenDashboard = async () => {
    setIsLoading(true);
    try {
      const result = await getStripeDashboardLink();
      if (result.success) {
        window.open(result.data.url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Failed to open payment dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg p-4',
        config.bgColor,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} aria-hidden="true" />
        <div>
          <p className={cn('text-sm font-medium', config.textColor)}>
            {config.label}
          </p>
          <p className="text-xs text-slate-500">{config.description}</p>
        </div>
      </div>

      {status === 'ready' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenDashboard}
          disabled={isLoading}
          className="flex-shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              Manage
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
