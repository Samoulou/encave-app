import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Inbox } from 'lucide-react';
import { RequestStatus, RequestOfferStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { getClientRequests } from '@/server/queries/request.queries';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

// Client-facing status copy (surMesure namespace): EXPIRED and CLOSED both
// read as "Expirée" (decision — the client doesn't distinguish the two).
const CLIENT_STATUS: Record<
  RequestStatus,
  { key: string; variant: BadgeVariant }
> = {
  [RequestStatus.PENDING]: { key: 'statusPending', variant: 'warning' },
  [RequestStatus.OFFERED]: { key: 'statusOffered', variant: 'info' },
  [RequestStatus.PAID]: { key: 'statusPaid', variant: 'success' },
  [RequestStatus.EXPIRED]: { key: 'statusExpired', variant: 'neutral' },
  [RequestStatus.CLOSED]: { key: 'statusExpired', variant: 'neutral' },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.myRequests',
    noIndex: true,
  });
}

export default async function MyRequestsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/${locale}/login`);
  }

  const [t, requests] = await Promise.all([
    getTranslations('surMesure'),
    getClientRequests(session.user.email),
  ]);
  const localeTyped = locale as Locale;
  const now = Date.now();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t('myRequestsTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('myRequestsSubtitle')}
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title={t('myRequestsEmptyTitle')}
            description={t('myRequestsEmptyBody')}
            icon={<Inbox className="h-10 w-10 text-burgundy-400" />}
          />
          <div className="text-center">
            <Button asChild>
              <Link href="/sur-mesure">{t('myRequestsEmptyCta')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const badge = CLIENT_STATUS[request.status];
            const offer = request.offer;
            const payable =
              offer != null &&
              offer.status === RequestOfferStatus.SENT &&
              offer.paymentToken != null &&
              offer.expiresAt.getTime() > now;

            return (
              <li
                key={request.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {request.wineryName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {request.reference}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('guests', { count: request.guestCount })}
                      {' · '}
                      {request.desiredDate
                        ? t('desiredDate', {
                            date: formatDate(request.desiredDate, localeTyped),
                          })
                        : t('desiredDateFlexible')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('requestedOn', {
                        date: formatDate(request.createdAt, localeTyped),
                      })}
                    </p>
                  </div>
                  <Badge variant={badge.variant}>{t(badge.key)}</Badge>
                </div>

                {offer && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
                    <div>
                      <p className="font-display text-lg font-semibold text-burgundy-800">
                        {t('offerAmount', {
                          amount: formatCHF(offer.totalPrice),
                        })}
                      </p>
                      {payable && (
                        <p className="text-xs text-muted-foreground">
                          {t('offerValidUntil', {
                            date: formatDate(offer.expiresAt, localeTyped),
                          })}
                        </p>
                      )}
                    </div>
                    {payable && offer.paymentToken && (
                      <Button asChild size="sm">
                        <Link href={`/sur-mesure/offre/${offer.paymentToken}`}>
                          {t('payCta')}
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
