import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight, Inbox } from 'lucide-react';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getWineryNavContext } from '@/server/queries/winery.queries';
import { getWineryRequests } from '@/server/queries/request.queries';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import {
  REQUEST_STATUS_BADGE,
  type RequestBadge,
} from '@/components/features/requests/request-status';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    path: '/dashboard/demandes',
    namespace: 'metadata.dashboard.requests',
    noIndex: true,
  });
}

export default async function RequestsInboxPage({ params }: Props) {
  const { locale } = await params;
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

  const [t, requests] = await Promise.all([
    getTranslations('requests'),
    getWineryRequests(winery.id),
  ]);
  const localeTyped = locale as Locale;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('inboxTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inboxSubtitle')}
        </p>
      </header>

      {requests.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyBody')}
          icon={<Inbox className="h-10 w-10 text-burgundy-400" />}
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const badge: RequestBadge = REQUEST_STATUS_BADGE[request.status];
            return (
              <li key={request.id}>
                <Link
                  href={`/dashboard/demandes/${request.id}`}
                  className="group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {request.clientName}
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
                              date: formatDate(
                                request.desiredDate,
                                localeTyped
                              ),
                            })
                          : t('desiredDateNone')}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {request.budget != null
                          ? t('budget', {
                              amount: formatCHF(request.budget),
                            })
                          : t('budgetNone')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('receivedOn', {
                          date: formatDate(request.createdAt, localeTyped),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={badge.variant}>{t(badge.key)}</Badge>
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
