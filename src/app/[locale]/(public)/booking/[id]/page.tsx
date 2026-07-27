import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/lib/i18n/formatters';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getBookingByToken } from '@/server/actions/booking';
import { BookingStatus } from '@prisma/client';
import { AddToCalendar } from '@/components/features/booking/AddToCalendar';
import { CancellationPolicy } from '@/components/features/booking/CancellationPolicy';
import { CancelBookingButton } from '@/components/features/booking/CancelBookingButton';
import { formatCHF } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
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
    namespace: 'metadata.booking.detail',
    noIndex: true,
  });
}

interface BookingPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

async function getBooking(id: string, token?: string) {
  if (!token) return null;

  const result = await getBookingByToken(token);
  if (result.success && result.data.id === id) {
    return result.data;
  }

  return null;
}

function formatTime(time: string): string {
  const parts = time.split(':');
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getStatusIcon(status: BookingStatus) {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return <CheckCircle className="h-6 w-6 text-green-600" />;
    case BookingStatus.CANCELLED_BY_CLIENT:
    case BookingStatus.CANCELLED_BY_WINERY:
      return <XCircle className="h-6 w-6 text-red-600" />;
    case BookingStatus.COMPLETED:
      return <CheckCircle className="h-6 w-6 text-blue-600" />;
    default:
      return <AlertCircle className="h-6 w-6 text-yellow-600" />;
  }
}

function getStatusColor(status: BookingStatus) {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return 'bg-green-100 text-green-800';
    case BookingStatus.CANCELLED_BY_CLIENT:
    case BookingStatus.CANCELLED_BY_WINERY:
      return 'bg-red-100 text-red-800';
    case BookingStatus.COMPLETED:
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { id, locale } = await params;
  const { token } = await searchParams;
  const t = await getTranslations('booking');
  const tConfirmation = await getTranslations('confirmation');

  const booking = await getBooking(id, token);

  if (!booking) {
    notFound();
  }

  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isCancelled =
    booking.status === BookingStatus.CANCELLED_BY_CLIENT ||
    booking.status === BookingStatus.CANCELLED_BY_WINERY;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* Status Header */}
      <div className="mb-8 flex items-center gap-3">
        {getStatusIcon(booking.status)}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('bookingDetails')}
          </h1>
          <span
            className={cn(
              'mt-1 inline-block rounded-full px-2 py-1 text-xs font-medium',
              getStatusColor(booking.status)
            )}
          >
            {t(`status.${booking.status}`)}
          </span>
        </div>
      </div>

      {/* Booking Reference */}
      <Card className="mb-6">
        <CardContent className="p-6 text-center">
          <p className="mb-1 text-sm text-muted-foreground">
            {tConfirmation('bookingReference')}
          </p>
          <p className="font-mono text-2xl font-bold text-burgundy-600">
            {booking.reference}
          </p>
        </CardContent>
      </Card>

      {/* Experience Details */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 flex-shrink-0 sm:h-auto sm:w-48">
            <Image
              src={booking.experience.coverPhoto}
              alt={booking.experience.title}
              fill
              className="object-cover"
            />
          </div>
          <CardContent className="flex-1 p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-foreground">
              {booking.experience.title}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="h-5 w-5 text-burgundy-600" />
                <span>
                  {formatDate(new Date(booking.date), locale as Locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 text-burgundy-600" />
                <span>
                  {formatTime(booking.timeSlot)} ({booking.experience.duration}{' '}
                  min)
                </span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Users className="h-5 w-5 text-burgundy-600" />
                <span>{t('guests', { count: booking.guestCount })}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-stone-200 pt-4">
              {booking.serviceFeeCents > 0 && (
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">
                    {tConfirmation('serviceFee')}
                  </span>
                  <span className="text-slate-600">
                    {formatCHF(booking.serviceFeeCents)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {tConfirmation('totalPaid')}
                </span>
                <span className="text-xl font-bold text-burgundy-600">
                  {formatCHF(booking.totalPrice + booking.serviceFeeCents)}
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Add to Calendar (only for confirmed bookings) */}
      {isConfirmed && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="mb-4 font-semibold text-foreground">
              {tConfirmation('addToCalendar')}
            </h3>
            <AddToCalendar
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
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Winery Details */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="mb-4 font-semibold text-foreground">
            {tConfirmation('wineryDetails')}
          </h3>

          <div className="space-y-3">
            <p className="font-medium text-foreground">{booking.winery.name}</p>

            <div className="flex items-start gap-3 text-muted-foreground">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-burgundy-600" />
              <div>
                <p>{booking.winery.address}</p>
                <p>{booking.winery.commune}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${booking.winery.address}, ${booking.winery.commune}, Switzerland`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-burgundy-600 hover:text-burgundy-700"
                >
                  {tConfirmation('getDirections')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <Phone className="h-5 w-5 text-burgundy-600" />
              <a
                href={`tel:${booking.winery.phone}`}
                className="hover:text-burgundy-600"
              >
                {booking.winery.phone}
              </a>
            </div>

            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-5 w-5 text-burgundy-600" />
              <a
                href={`mailto:${booking.winery.email}`}
                className="hover:text-burgundy-600"
              >
                {booking.winery.email}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation Policy and Cancel Button (only for confirmed bookings) */}
      {isConfirmed && !isCancelled && token && (
        <div className="mb-8 space-y-4">
          <CancellationPolicy />
          <div className="flex justify-center">
            <CancelBookingButton bookingId={booking.id} accessToken={token} />
          </div>
        </div>
      )}

      {/* Visitor Details */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="mb-4 font-semibold text-foreground">
            {tConfirmation('yourDetails')}
          </h3>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-medium">{tConfirmation('name')}:</span>{' '}
              {booking.visitorName}
            </p>
            <p>
              <span className="font-medium">{tConfirmation('email')}:</span>{' '}
              {booking.visitorEmail}
            </p>
            <p>
              <span className="font-medium">{tConfirmation('phone')}:</span>{' '}
              {booking.visitorPhone}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <Button asChild variant="outline">
          <Link href={`/experiences/${booking.experience.slug}`}>
            {tConfirmation('viewExperience')}
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">{tConfirmation('browseMore')}</Link>
        </Button>
      </div>
    </div>
  );
}
