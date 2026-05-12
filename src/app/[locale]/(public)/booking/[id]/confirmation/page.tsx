import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';
import {
  ConfirmationHeader,
  ConfirmationFinalizing,
  ConfirmationPaymentFailed,
  BookingReferenceHeader,
  BookingDetailsSection,
  ExperienceVisual,
  WineryInfoCard,
  ModifyBookingCard,
  ConfirmationActions,
} from '@/components/features/booking/confirmation';
import { reconcileBookingPayment } from '@/server/actions/booking/reconcileBookingPayment';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { logWarn } from '@/lib/logger';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.booking.confirmation',
    noIndex: true,
  });
}

interface ConfirmationPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{
    session_id?: string | string[];
    t?: string | string[];
  }>;
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatTime(time: string): string {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatEndTime(time: string, durationMinutes: number): string {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

async function loadBooking(id: string) {
  return db.booking.findUnique({
    where: { id },
    include: {
      experience: {
        select: {
          title: true,
          slug: true,
          duration: true,
          coverPhoto: true,
        },
      },
      winery: {
        select: {
          name: true,
          slug: true,
          address: true,
          commune: true,
          phone: true,
          email: true,
        },
      },
    },
  });
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<ConfirmationFinalizing />}>
      <ConfirmationResolver
        id={id}
        locale={locale}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

interface ConfirmationResolverProps {
  id: string;
  locale: string;
  searchParams: ConfirmationPageProps['searchParams'];
}

async function ConfirmationResolver({
  id,
  locale,
  searchParams,
}: ConfirmationResolverProps) {
  const sp = await searchParams;
  const sessionId = pickFirst(sp.session_id);
  const accessToken = pickFirst(sp.t);

  let booking = await loadBooking(id);
  if (!booking) {
    notFound();
  }

  // ENC-067 — Synchronous reconciliation fallback. Webhook stays the source
  // of truth in prod; this runs when the client lands here before/without
  // a webhook (preview deploys).
  if (booking.status === BookingStatus.PENDING_PAYMENT && sessionId) {
    const reco = await reconcileBookingPayment({
      bookingId: id,
      sessionId,
      ...(accessToken ? { accessToken } : {}),
    });

    if (reco.success) {
      if (reco.data.kind === 'PAYMENT_FAILED_INSTANT') {
        return (
          <ConfirmationPaymentFailed experienceSlug={booking.experience.slug} />
        );
      }
      if (reco.data.kind === 'SESSION_EXPIRED') {
        // No DB write — the cron will sweep this booking. Render the failed
        // UI which already invites the client to start a new booking.
        return (
          <ConfirmationPaymentFailed experienceSlug={booking.experience.slug} />
        );
      }
      if (
        reco.data.kind === 'CONFIRMED' ||
        reco.data.kind === 'ALREADY_CONFIRMED' ||
        reco.data.kind === 'ALREADY_CANCELLED'
      ) {
        // M3 — re-fetch the booking so the branch below renders fresh state.
        // CONFIRMED obviously needs a re-read (the row was just flipped),
        // but ALREADY_* also benefit: between the first loadBooking and the
        // reconcile call, the webhook may have flipped the row to CONFIRMED
        // or another path may have cancelled it. One extra SSR query is
        // acceptable to avoid rendering stale state.
        booking = await loadBooking(id);
        if (!booking) notFound();
      }
    } else {
      // Best-effort fallback: log and keep rendering the pending UI.
      logWarn('Reconciliation failed, falling back to pending UI', {
        bookingId: id,
        code: reco.error.code,
      });
    }
  }

  // Branch on current DB status.
  if (
    booking.status === BookingStatus.CANCELLED_BY_CLIENT ||
    booking.status === BookingStatus.CANCELLED_BY_WINERY
  ) {
    return (
      <ConfirmationPaymentFailed experienceSlug={booking.experience.slug} />
    );
  }

  // Either CONFIRMED, COMPLETED, NO_SHOW, or still PENDING_PAYMENT without
  // a session_id (legacy / direct visit). Render the success layout — the
  // header subtitle / CTAs adapt naturally.
  return <ConfirmedView booking={booking} locale={locale} />;
}

interface ConfirmedViewProps {
  booking: NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
  locale: string;
}

async function ConfirmedView({ booking, locale: _locale }: ConfirmedViewProps) {
  const t = await getTranslations('booking.confirmation');
  const tLegacy = await getTranslations('confirmation');

  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const formattedDate = booking.date.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = `${formatTime(booking.timeSlot)} - ${formatEndTime(booking.timeSlot, booking.experience.duration)}`;

  return (
    <div className="flex flex-1 justify-center px-4 py-10 md:px-10">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <ConfirmationHeader
            title={t('confirmed.title')}
            subtitle={t('confirmed.subtitle')}
          />

          <Card className="overflow-hidden hover:translate-y-0 hover:shadow-card">
            <BookingReferenceHeader
              reference={booking.reference}
              isConfirmed={isConfirmed}
            />
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <BookingDetailsSection
                  experienceTitle={booking.experience.title}
                  wineryName={booking.winery.name}
                  formattedDate={formattedDate}
                  formattedTime={formattedTime}
                  guestCount={booking.guestCount}
                  totalPrice={booking.totalPrice}
                />
                <ExperienceVisual
                  coverPhoto={booking.experience.coverPhoto}
                  experienceTitle={booking.experience.title}
                  bookingId={booking.id}
                />
              </div>
            </CardContent>
          </Card>

          <ConfirmationActions
            booking={{
              experienceTitle: booking.experience.title,
              wineryName: booking.winery.name,
              wineryAddress: booking.winery.address,
              wineryCommune: booking.winery.commune,
              date: booking.date,
              timeSlot: booking.timeSlot,
              durationMinutes: booking.experience.duration,
              guestCount: booking.guestCount,
              reference: booking.reference,
              id: booking.id,
            }}
          />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <WineryInfoCard
            address={booking.winery.address}
            commune={booking.winery.commune}
            phone={booking.winery.phone}
            email={booking.winery.email}
          />
          <ModifyBookingCard bookingId={booking.id} />
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 flex w-full justify-center gap-6 bg-gradient-to-t from-[#f8f6f6] to-transparent py-8 pb-12">
        <Link
          href="/experiences"
          className="pointer-events-auto inline-flex items-center gap-2 font-semibold text-[#915564] transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {tLegacy('returnToExperiences')}
        </Link>
        <Link
          href="/dashboard/my-bookings"
          className="pointer-events-auto inline-flex items-center gap-2 font-semibold text-[#915564] transition-colors hover:text-primary"
        >
          <CalendarCheck className="size-4" />
          {tLegacy('viewMyBookings')}
        </Link>
      </div>
    </div>
  );
}
