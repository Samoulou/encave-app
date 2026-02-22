import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, CalendarCheck, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';
import {
  ConfirmationSuccess,
  BookingReferenceHeader,
  BookingDetailsSection,
  ExperienceVisual,
  WineryInfoCard,
  ModifyBookingCard,
  ConfirmationActions,
} from '@/components/features/booking/confirmation';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.booking.confirmation',
    noIndex: true,
  });
}

interface ConfirmationPageProps {
  params: Promise<{ id: string; locale: string }>;
}

async function getBooking(id: string) {
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

  return booking;
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

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { id, locale } = await params;
  const t = await getTranslations('confirmation');
  const booking = await getBooking(id);

  if (!booking) {
    notFound();
  }

  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isPending = booking.status === BookingStatus.PENDING_PAYMENT;

  const formattedDate = format(new Date(booking.date), 'MMM d, yyyy');
  const formattedTime = `${formatTime(booking.timeSlot)} - ${formatEndTime(booking.timeSlot, booking.experience.duration)}`;

  // Pending Payment State
  if (isPending) {
    return (
      <div className="flex-1 flex justify-center py-10 px-4 md:px-10">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              {t('paymentPending')}
            </h1>
            <p className="text-[#915564]">{t('paymentPendingDescription')}</p>
          </div>

          <Card className="mb-6 border-border">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-[#915564] mb-1">{t('bookingReference')}</p>
              <p className="text-2xl font-mono font-bold text-primary">
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
    <div className="flex-1 flex justify-center py-10 px-4 md:px-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Confirmation & Actions */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Hero Status */}
          <ConfirmationSuccess visitorEmail={booking.visitorEmail} />

          {/* Booking Details Card */}
          <Card className="overflow-hidden hover:translate-y-0 hover:shadow-card">
            <BookingReferenceHeader
              reference={booking.reference}
              isConfirmed={isConfirmed}
            />
            <CardContent className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Experience Info */}
                <BookingDetailsSection
                  experienceTitle={booking.experience.title}
                  wineryName={booking.winery.name}
                  formattedDate={formattedDate}
                  formattedTime={formattedTime}
                  guestCount={booking.guestCount}
                  totalPrice={booking.totalPrice}
                />

                {/* Visual/QR Side */}
                <ExperienceVisual
                  coverPhoto={booking.experience.coverPhoto}
                  experienceTitle={booking.experience.title}
                  bookingId={booking.id}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
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

        {/* Right Column: Winery Contact & Help */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Winery Contact Card */}
          <WineryInfoCard
            address={booking.winery.address}
            commune={booking.winery.commune}
            phone={booking.winery.phone}
            email={booking.winery.email}
          />

          {/* Need Help Card */}
          <ModifyBookingCard bookingId={booking.id} />
        </div>
      </div>

      {/* Bottom CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 w-full flex justify-center gap-6 py-8 pb-12 bg-gradient-to-t from-[#f8f6f6] to-transparent pointer-events-none">
        <Link
          href={`/${locale}/experiences`}
          className="inline-flex items-center gap-2 text-[#915564] hover:text-primary transition-colors font-semibold pointer-events-auto"
        >
          <ArrowLeft className="size-4" />
          {t('returnToExperiences')}
        </Link>
        <Link
          href={`/${locale}/dashboard/my-bookings`}
          className="inline-flex items-center gap-2 text-[#915564] hover:text-primary transition-colors font-semibold pointer-events-auto"
        >
          <CalendarCheck className="size-4" />
          {t('viewMyBookings')}
        </Link>
      </div>
    </div>
  );
}
