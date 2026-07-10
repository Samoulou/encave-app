import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronRight, Landmark } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  listWineryPayouts,
  getNextPayout,
  type PayoutStatus,
} from '@/server/queries/payouts.queries';
import { PayoutsErrorBanner } from '@/components/features/payouts/PayoutsErrorBanner';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { formatCHF } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/i18n/formatters';
import { logError } from '@/lib/logger';
import type { Locale } from '@/i18n/routing';

const STATUS_VARIANT: Record<PayoutStatus, BadgeProps['variant']> = {
  paid: 'success',
  pending: 'warning',
  in_transit: 'info',
  failed: 'destructive',
  canceled: 'neutral',
};

interface PayoutsListProps {
  stripeAccountId: string;
}

/**
 * Payout history + « prochain virement » card. Stripe failures render
 * the ENC-114 retry banner — the page never falls back to a guess.
 */
export async function PayoutsList({ stripeAccountId }: PayoutsListProps) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations('Payouts'),
  ]);

  let payouts;
  let nextPayout;
  try {
    [payouts, nextPayout] = await Promise.all([
      listWineryPayouts(stripeAccountId),
      getNextPayout(stripeAccountId),
    ]);
  } catch (error) {
    logError('payouts list fetch failed', error, { action: 'PayoutsList' });
    return <PayoutsErrorBanner />;
  }

  return (
    <div className="space-y-4">
      {/* Next payout — the DoD headline number */}
      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-muted-foreground">
          {t('next.title')}
        </p>
        {nextPayout.kind === 'payout' ? (
          <>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">
              {formatCHF(nextPayout.amountCents)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('next.arrival', {
                date: formatDateShort(
                  new Date(nextPayout.arrivalDateMs),
                  locale as Locale
                ),
              })}
            </p>
          </>
        ) : nextPayout.kind === 'balance' ? (
          <>
            <p className="mt-1 font-display text-3xl font-bold text-foreground">
              {formatCHF(nextPayout.amountCents)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('next.accruing')}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t('next.none')}</p>
        )}
      </div>

      {/* History */}
      {payouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <Landmark
            className="mx-auto h-10 w-10 text-stone-400"
            aria-hidden="true"
          />
          <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
            {t('empty.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t('empty.body')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-border bg-white">
          {payouts.map((payout) => (
            <li key={payout.id}>
              <Link
                href={`/dashboard/payouts/${payout.id}`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-stone-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {formatDateShort(
                      new Date(payout.arrivalDateMs),
                      locale as Locale
                    )}
                  </p>
                  <Badge
                    variant={STATUS_VARIANT[payout.status]}
                    className="mt-1"
                  >
                    {t(`status.${payout.status}`)}
                  </Badge>
                </div>
                <p className="shrink-0 font-display text-lg font-semibold text-foreground">
                  {formatCHF(payout.amountCents)}
                </p>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
