import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { format } from 'date-fns';
import type Stripe from 'stripe';
import { ArrowLeft, CalendarCheck, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/server/db';
import { auth } from '@/server/auth';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { confirmBookingFromPaidCheckoutSession } from '@/server/services/checkout-confirmation.service';
import { userExistsByEmail } from '@/server/queries/user.queries';
import { BookingStatus } from '@prisma/client';
import {
  ConfirmationSuccess,
  BookingReferenceHeader,
  BookingDetailsSection,
  ExperienceVisual,
  WineryInfoCard,
  ConfirmationActions,
} from '@/components/features/booking/confirmation';
import { OneTapAccountCard } from '@/components/features/booking/confirmation/OneTapAccountCard';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { getBaseUrl } from '@/lib/env';
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
  searchParams: Promise<{ session_id?: string }>;
}

async function getValidCheckoutSession(
  id: string,
  sessionId: string | undefined
): Promise<Stripe.Checkout.Session | null> {
  if (!sessionId || !isStripeConfigured()) {
    return null;
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return session.metadata?.bookingId === id ? session : null;
  } catch {
    return null;
  }
}

async function getBooking(id: string, sessionId: string | undefined) {
  const session = await getValidCheckoutSession(id, sessionId);
  if (!session) {
    return null;
  }

  // When this page wins the confirmation race it receives the plaintext
  // access token (never recoverable later — only the hash is stored) and
  // can render a scanner-compatible ticket QR on screen.
  let accessToken: string | undefined;
  if (session.payment_status === 'paid') {
    const outcome = await confirmBookingFromPaidCheckoutSession(
      session,
      'confirmation_page'
    );
    accessToken = outcome.accessToken;
  }

  const booking = await db.booking.findUnique({
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
          id: true,
          name: true,
          slug: true,
          address: true,
          commune: true,
          phone: true,
          email: true,
          coverPhoto: true,
          latitude: true,
          longitude: true,
          _count: {
            select: {
              experiences: true,
            },
          },
        },
      },
    },
  });

  if (
    booking?.stripeCheckoutSessionId?.startsWith('cs_') &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    return null;
  }

  if (!booking) {
    return null;
  }

  return { booking, accessToken };
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

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { id, locale } = await params;
  const { session_id: sessionId } = await searchParams;
  const t = await getTranslations('confirmation');
  const bookingResult = await getBooking(id, sessionId);

  if (!bookingResult) {
    notFound();
  }

  const { booking, accessToken } = bookingResult;
  const ticketUrl = accessToken
    ? `${getBaseUrl()}/${locale}/booking/${booking.id}?token=${accessToken}`
    : undefined;

  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isPending = booking.status === BookingStatus.PENDING_PAYMENT;

  // One-tap account (P-04 / L-053): only for guests whose booking email
  // has no account yet — the check stays server-side, never in the card.
  const [session, accountExists] = await Promise.all([
    auth(),
    userExistsByEmail(booking.visitorEmail),
  ]);
  const showOneTapAccount = !session && !accountExists;

  const formattedDate = format(new Date(booking.date), 'MMM d, yyyy');
  const formattedTime = `${formatTime(booking.timeSlot)} - ${formatEndTime(booking.timeSlot, booking.experience.duration)}`;

  // Pending Payment State
  if (isPending) {
    return (
      <div className="flex flex-1 justify-center px-4 py-10 md:px-10">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>
            <h1 className="mb-2 font-display text-3xl font-bold text-foreground">
              {t('paymentPending')}
            </h1>
            <p className="text-muted-foreground">
              {t('paymentPendingDescription')}
            </p>
          </div>

          <Card className="mb-6 border-border">
            <CardContent className="p-6 text-center">
              <p className="mb-1 text-sm text-muted-foreground">
                {t('bookingReference')}
              </p>
              <p className="font-mono text-2xl font-bold text-primary">
                {booking.reference}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main Confirmed State - Two Column Layout
  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Confirmation & Actions */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Hero Status */}
          <ConfirmationSuccess visitorEmail={booking.visitorEmail} />

          {/* Booking Details Card */}
          <Card className="overflow-hidden hover:translate-y-0 hover:shadow-card">
            <BookingReferenceHeader
              reference={booking.reference}
              isConfirmed={isConfirmed}
            />
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Experience Info */}
                <BookingDetailsSection
                  experienceTitle={booking.experience.title}
                  wineryName={booking.winery.name}
                  formattedDate={formattedDate}
                  formattedTime={formattedTime}
                  guestCount={booking.guestCount}
                  totalPrice={booking.totalPrice}
                  serviceFeeCents={booking.serviceFeeCents}
                />

                {/* Visual/QR Side */}
                <ExperienceVisual
                  coverPhoto={booking.experience.coverPhoto}
                  experienceTitle={booking.experience.title}
                  ticketUrl={ticketUrl}
                />
              </div>
            </CardContent>
          </Card>

          {/* One-tap account creation (guests only, L-053) */}
          {showOneTapAccount && (
            <OneTapAccountCard
              visitorEmail={booking.visitorEmail}
              visitorName={booking.visitorName}
            />
          )}

          {/* Action Buttons */}
          <div className="space-y-8">
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

            <nav
              aria-label={t('bookingStatus')}
              className="flex flex-col gap-3 border-t border-border pt-6 text-sm font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-center sm:gap-6"
            >
              <Link
                href={`/${locale}/experiences`}
                className="inline-flex items-center justify-center gap-2 transition-colors hover:text-primary"
              >
                <ArrowLeft className="size-4 shrink-0" />
                <span>{t('returnToExperiences')}</span>
              </Link>
              <Link
                href={`/${locale}/dashboard/my-bookings`}
                className="inline-flex items-center justify-center gap-2 transition-colors hover:text-primary"
              >
                <CalendarCheck className="size-4 shrink-0" />
                <span>{t('viewMyBookings')}</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Right Column: Winery Contact & Help */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Winery Contact Card */}
          <WineryInfoCard
            winery={{
              id: booking.winery.id,
              name: booking.winery.name,
              slug: booking.winery.slug,
              commune: booking.winery.commune,
              coverPhoto: booking.winery.coverPhoto,
              latitude: booking.winery.latitude,
              longitude: booking.winery.longitude,
              _count: booking.winery._count,
            }}
            address={booking.winery.address}
            commune={booking.winery.commune}
            phone={booking.winery.phone}
            email={booking.winery.email}
          />
        </div>
      </div>
    </div>
  );
}
