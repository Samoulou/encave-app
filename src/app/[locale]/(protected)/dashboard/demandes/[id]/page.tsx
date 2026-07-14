import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { RequestStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getWineryNavContext } from '@/server/queries/winery.queries';
import { getRequestDetail } from '@/server/queries/request.queries';
import { ComposeOfferForm } from '@/components/features/requests/ComposeOfferForm';
import {
  REQUEST_STATUS_BADGE,
  REQUEST_OFFER_STATUS_BADGE,
} from '@/components/features/requests/request-status';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.requests',
    noIndex: true,
  });
}

export default async function RequestDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user || session.user.role !== 'WINEMAKER') {
    notFound();
  }
  if (!(await isFlagEnabled('REQUESTS'))) {
    notFound();
  }

  const winery = await getWineryNavContext(session.user.id);
  if (!winery) {
    notFound();
  }

  const [t, request] = await Promise.all([
    getTranslations('requests'),
    getRequestDetail(winery.id, id),
  ]);
  if (!request) {
    notFound();
  }

  const localeTyped = locale as Locale;
  const statusBadge = REQUEST_STATUS_BADGE[request.status];
  const latestOffer = request.offers[0] ?? null;
  const isPending = request.status === RequestStatus.PENDING;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/demandes"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToInbox')}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('detailTitle', { reference: request.reference })}
        </h1>
        <Badge variant={statusBadge.variant}>{t(statusBadge.key)}</Badge>
      </header>

      {/* Client */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-medium text-foreground">{t('clientSection')}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('clientName')}</dt>
            <dd className="text-right font-medium text-foreground">
              {request.clientName}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('clientEmail')}</dt>
            <dd className="text-right font-medium text-foreground">
              <a
                href={`mailto:${request.clientEmail}`}
                className="break-all hover:text-primary"
              >
                {request.clientEmail}
              </a>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('clientPhone')}</dt>
            <dd className="text-right font-medium text-foreground">
              {request.clientPhone ? (
                <a
                  href={`tel:${request.clientPhone}`}
                  className="hover:text-primary"
                >
                  {request.clientPhone}
                </a>
              ) : (
                t('notProvided')
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Project */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-medium text-foreground">{t('projectSection')}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('guestsLabel')}</dt>
            <dd className="font-medium text-foreground">
              {t('guests', { count: request.guestCount })}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('desiredDateLabel')}</dt>
            <dd className="font-medium text-foreground">
              {request.desiredDate
                ? formatDate(request.desiredDate, localeTyped)
                : t('flexibleDate')}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t('budgetLabel')}</dt>
            <dd className="font-medium text-foreground">
              {request.budget != null
                ? formatCHF(request.budget)
                : t('notProvided')}
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <p className="text-sm text-muted-foreground">
            {t('descriptionLabel')}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {request.description}
          </p>
        </div>
      </section>

      {/* Compose (PENDING) or existing offer */}
      {isPending ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-medium text-foreground">{t('composeTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('composeSubtitle')}
          </p>
          <div className="mt-6">
            <ComposeOfferForm requestId={request.id} />
          </div>
        </section>
      ) : latestOffer ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-foreground">
              {t('offerSectionTitle')}
            </h2>
            <Badge
              variant={REQUEST_OFFER_STATUS_BADGE[latestOffer.status].variant}
            >
              {t(REQUEST_OFFER_STATUS_BADGE[latestOffer.status].key)}
            </Badge>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('offerPrice')}</dt>
              <dd className="font-display text-lg font-semibold text-burgundy-800">
                {formatCHF(latestOffer.totalPrice)}
              </dd>
            </div>
            {latestOffer.scheduledDate && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('offerDate')}</dt>
                <dd className="font-medium text-foreground">
                  {formatDate(latestOffer.scheduledDate, localeTyped)}
                  {latestOffer.scheduledStartTime
                    ? ` · ${latestOffer.scheduledStartTime}`
                    : ''}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('offerExpiry')}</dt>
              <dd className="font-medium text-foreground">
                {formatDate(latestOffer.expiresAt, localeTyped)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="text-sm text-muted-foreground">{t('offerMessage')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {latestOffer.message}
            </p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('offerSentOn', {
              date: formatDate(latestOffer.createdAt, localeTyped),
            })}
          </p>
        </section>
      ) : null}
    </div>
  );
}
