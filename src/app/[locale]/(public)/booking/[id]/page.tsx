import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
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
import { db } from '@/server/db';
import { getBookingByToken } from '@/server/actions/booking';
import { BookingStatus } from '@prisma/client';
import {
  AddToCalendar,
  CancellationPolicy,
  CancelBookingButton,
} from '@/components/features/booking';
import { formatCHF } from '@/lib/utils/currency';

interface BookingPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

async function getBooking(id: string, token?: string) {
  // If token provided, use token-based access
  if (token) {
    const result = await getBookingByToken(token);
    if (result.success && result.data.id === id) {
      return result.data;
    }
  }

  // Otherwise, try to get booking by ID (for logged-in users or public reference lookup)
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

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { id } = await params;
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
      <div className="flex items-center gap-3 mb-8">
        {getStatusIcon(booking.status)}
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t('bookingDetails')}
          </h1>
          <span
            className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}
          >
            {booking.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Booking Reference */}
      <Card className="mb-6">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-slate-500 mb-1">{tConfirmation('bookingReference')}</p>
          <p className="text-2xl font-mono font-bold text-burgundy-600">{booking.reference}</p>
        </CardContent>
      </Card>

      {/* Experience Details */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 sm:h-auto sm:w-48 flex-shrink-0">
            <Image
              src={booking.experience.coverPhoto}
              alt={booking.experience.title}
              fill
              className="object-cover"
            />
          </div>
          <CardContent className="flex-1 p-6">
            <h2 className="font-display text-xl font-bold text-slate-900 mb-4">
              {booking.experience.title}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="h-5 w-5 text-burgundy-600" />
                <span>{format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>

              <div className="flex items-center gap-3 text-slate-600">
                <Clock className="h-5 w-5 text-burgundy-600" />
                <span>
                  {formatTime(booking.timeSlot)} ({booking.experience.duration} min)
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-600">
                <Users className="h-5 w-5 text-burgundy-600" />
                <span>
                  {booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-stone-200">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-600">{tConfirmation('totalPaid')}</span>
                <span className="text-xl font-bold text-burgundy-600">
                  {formatCHF(booking.totalPrice)}
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
            <h3 className="font-semibold text-slate-900 mb-4">
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
          <h3 className="font-semibold text-slate-900 mb-4">{tConfirmation('wineryDetails')}</h3>

          <div className="space-y-3">
            <p className="font-medium text-slate-900">{booking.winery.name}</p>

            <div className="flex items-start gap-3 text-slate-600">
              <MapPin className="h-5 w-5 text-burgundy-600 flex-shrink-0 mt-0.5" />
              <div>
                <p>{booking.winery.address}</p>
                <p>{booking.winery.commune}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${booking.winery.address}, ${booking.winery.commune}, Switzerland`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-burgundy-600 hover:text-burgundy-700 mt-1"
                >
                  {tConfirmation('getDirections')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="h-5 w-5 text-burgundy-600" />
              <a href={`tel:${booking.winery.phone}`} className="hover:text-burgundy-600">
                {booking.winery.phone}
              </a>
            </div>

            <div className="flex items-center gap-3 text-slate-600">
              <Mail className="h-5 w-5 text-burgundy-600" />
              <a href={`mailto:${booking.winery.email}`} className="hover:text-burgundy-600">
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
            <CancelBookingButton
              bookingId={booking.id}
              accessToken={token}
              totalPrice={booking.totalPrice}
            />
          </div>
        </div>
      )}

      {/* Visitor Details */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{tConfirmation('yourDetails')}</h3>
          <div className="space-y-2 text-slate-600">
            <p>
              <span className="font-medium">{tConfirmation('name')}:</span> {booking.visitorName}
            </p>
            <p>
              <span className="font-medium">{tConfirmation('email')}:</span> {booking.visitorEmail}
            </p>
            <p>
              <span className="font-medium">{tConfirmation('phone')}:</span> {booking.visitorPhone}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
