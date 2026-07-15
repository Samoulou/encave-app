import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BookingStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getParticipantCollectiveEvents } from '@/server/queries/participant-events.queries';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDateShort } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { Users } from 'lucide-react';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.collectiveEvents',
    noIndex: true,
  });
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ParticipantCollectiveEventsPage({
  params,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, collectiveEventsEnabled] = await Promise.all([
    auth(),
    isFlagEnabled('COLLECTIVE_EVENTS'),
  ]);

  // Flag OFF ⇒ the surface does not exist.
  if (!collectiveEventsEnabled || !session?.user) {
    notFound();
  }

  const [t, events] = await Promise.all([
    getTranslations('collectiveEvents'),
    getParticipantCollectiveEvents(session.user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-display-md text-foreground">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <Card key={event.experienceId} className="shadow-warm">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {event.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('organizedBy', { winery: event.organizerWineryName })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-4">
                  <div className="text-center">
                    <p className="font-display text-2xl font-semibold text-burgundy-700">
                      {event.soldSeats}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('sold')}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl font-semibold text-burgundy-700">
                      {event.checkedInSeats}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('scanned')}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-6 py-3">{t('attendees.name')}</th>
                        <th className="px-6 py-3">{t('attendees.contact')}</th>
                        <th className="px-6 py-3">{t('attendees.date')}</th>
                        <th className="px-6 py-3">{t('attendees.guests')}</th>
                        <th className="px-6 py-3">{t('attendees.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {event.attendees.map((attendee) => (
                        <tr key={attendee.bookingId}>
                          <td className="px-6 py-3 font-medium text-foreground">
                            {attendee.visitorName}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">
                            {attendee.visitorEmail}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">
                            {formatDateShort(attendee.date, locale as Locale)} ·{' '}
                            {attendee.timeSlot}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground">
                            {attendee.guestCount}
                          </td>
                          <td className="px-6 py-3">
                            {attendee.checkedInAt ? (
                              <Badge variant="success">
                                {t('attendees.checkedIn')}
                              </Badge>
                            ) : attendee.status === BookingStatus.NO_SHOW ? (
                              <Badge variant="destructive">
                                {t('attendees.noShow')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {t('attendees.expected')}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
