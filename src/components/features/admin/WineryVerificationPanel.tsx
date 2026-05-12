import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MapPin, XCircle } from 'lucide-react';
import type { WineryStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';

interface WineryVerificationPanelProps {
  winery: {
    name: string;
    commune: string;
    status: WineryStatus;
    rejectionReason: string | null;
  };
  /** Actions slot rendered on the right side of the header card */
  actions?: ReactNode;
}

export function WineryVerificationPanel({
  winery,
  actions,
}: WineryVerificationPanelProps) {
  const t = useTranslations('admin');

  return (
    <>
      {/* Header with name, status, and actions */}
      <Card className="shadow-warm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                {winery.name}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {winery.commune}, Valais
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                    winery.status === 'PENDING' &&
                      'bg-amber-100 text-amber-700',
                    winery.status === 'VERIFIED' &&
                      'bg-green-100 text-green-700',
                    winery.status === 'REJECTED' && 'bg-red-100 text-red-700'
                  )}
                >
                  {winery.status}
                </span>
              </div>
            </div>
            {actions}
          </div>
        </CardContent>
      </Card>

      {/* Rejection Reason Display (for already rejected wineries) */}
      {winery.status === 'REJECTED' && winery.rejectionReason && (
        <Card className="border-2 border-red-200 bg-red-50/50 shadow-warm">
          <CardHeader className="border-b border-red-100">
            <CardTitle className="flex items-center gap-2 text-lg text-red-700">
              <XCircle className="h-5 w-5" />
              {t('rejectionReason')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-red-600">{winery.rejectionReason}</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
