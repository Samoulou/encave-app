import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { Link } from '@/i18n/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { PayoutsErrorBanner } from '@/components/features/payouts/PayoutsErrorBanner';
import { getPayoutDetail } from '@/server/queries/payouts.queries';
import { formatCHF } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/i18n/formatters';
import { logError } from '@/lib/logger';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.payouts',
    noIndex: true,
  });
}

interface PayoutDetailPageProps {
  params: Promise<{ payoutId: string; locale: string }>;
}

/**
 * Payout composition (ENC-114 detail): the included bookings with
 * gross/commission/net, plus any unmatched balance lines (refund
 * reversals, adjustments) shown as-is. The Stripe query is scoped to
 * the caller's own account — a foreign payoutId is a plain 404.
 */
export default async function PayoutDetailPage({
  params,
}: PayoutDetailPageProps) {
  const [{ payoutId }, session, locale] = await Promise.all([
    params,
    auth(),
    getLocale(),
  ]);
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (!/^po_[A-Za-z0-9]+$/.test(payoutId)) {
    notFound();
  }

  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { stripeAccountId: true },
  });
  if (!winery?.stripeAccountId) {
    notFound();
  }

  const t = await getTranslations('Payouts');

  let detail;
  try {
    detail = await getPayoutDetail(winery.stripeAccountId, payoutId);
  } catch (error) {
    logError('payout detail fetch failed', error, {
      action: 'PayoutDetailPage',
      payoutId,
    });
    return (
      <WineryAccessGuard>
        <div className="mx-auto max-w-3xl space-y-4">
          <BackLink label={t('detail.back')} />
          <PayoutsErrorBanner />
        </div>
      </WineryAccessGuard>
    );
  }
  if (!detail) {
    notFound();
  }

  return (
    <WineryAccessGuard>
      <div className="mx-auto max-w-3xl space-y-6">
        <BackLink label={t('detail.back')} />

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('detail.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateShort(
              new Date(detail.payout.arrivalDateMs),
              locale as Locale
            )}
            {' · '}
            {t(`status.${detail.payout.status}`)}
          </p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">
              {t('detail.totalGross')}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground">
              {formatCHF(detail.totalGrossCents)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">
              {t('detail.totalCommission')}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground">
              {formatCHF(detail.totalCommissionCents)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">
              {t('detail.totalNet')}
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-foreground">
              {formatCHF(detail.payout.amountCents)}
            </p>
          </div>
        </div>

        {/* Included bookings */}
        <section className="rounded-xl border border-border bg-white p-4 lg:p-6">
          <h2 className="font-medium text-foreground">
            {t('detail.bookings')}
          </h2>
          {detail.bookings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t('detail.noBookings')}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {detail.bookings.map((line) => (
                <li
                  key={`${line.bookingId}-${line.kind}`}
                  className="flex items-center gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {line.experienceTitle}
                      {line.kind === 'gift' && (
                        <span className="ml-2 inline-block rounded-full bg-burgundy-50 px-2 py-0.5 text-xs font-medium text-burgundy-700">
                          {t('detail.giftBadge')}
                        </span>
                      )}
                      {line.kind === 'noShowFee' && (
                        <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t('detail.noShowBadge')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{line.reference}</span>
                      {' · '}
                      {formatDateShort(new Date(line.dateMs), locale as Locale)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>
                      {t('detail.gross')} {formatCHF(line.grossCents)}
                    </p>
                    <p>
                      {t('detail.commission')} −
                      {formatCHF(line.commissionCents)}
                    </p>
                  </div>
                  <p className="w-24 shrink-0 text-right font-display font-semibold text-foreground">
                    {formatCHF(line.netCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {detail.unmatchedLines.length > 0 && (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                {t('detail.otherLines')}
              </h3>
              <ul className="mt-2 space-y-1">
                {detail.unmatchedLines.map((line, index) => (
                  <li
                    key={`${line.type}-${index}`}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>
                      {line.type} ·{' '}
                      {formatDateShort(
                        new Date(line.createdMs),
                        locale as Locale
                      )}
                    </span>
                    <span className="font-mono">
                      {formatCHF(line.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </WineryAccessGuard>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard/payouts"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
