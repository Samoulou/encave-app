import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle, Calendar, Clock, Users, MapPin, Mail, Phone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';
import { AddToCalendar, CancellationPolicy } from '@/components/features/booking';
import { formatCHF } from '@/lib/utils/currency';

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
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { id } = await params;
  const t = await getTranslations('confirmation');
  const booking = await getBooking(id);

  if (!booking) {
    notFound();
  }

  // Only show confirmation for confirmed bookings
  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isPending = booking.status === BookingStatus.PENDING_PAYMENT;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* Success Header */}
      <div className="text-center mb-8">
        {isConfirmed ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">
              {t('bookingConfirmed')}
            </h1>
            <p className="text-slate-600">{t('confirmationSent')}</p>
          </>
        ) : isPending ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-10 w-10 text-yellow-600" />
            </div>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">
              {t('paymentPending')}
            </h1>
            <p className="text-slate-600">{t('paymentPendingDescription')}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold text-slate-900 mb-2">
              {t('bookingStatus')}
            </h1>
            <p className="text-slate-600">{booking.status}</p>
          </>
        )}
      </div>

      {/* Booking Reference */}
      <Card className="mb-6">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-slate-500 mb-1">{t('bookingReference')}</p>
          <p className="text-2xl font-mono font-bold text-burgundy-600">
            {booking.reference}
          </p>
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
              {/* Date */}
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="h-5 w-5 text-burgundy-600" />
                <span>{format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>

              {/* Time */}
              <div className="flex items-center gap-3 text-slate-600">
                <Clock className="h-5 w-5 text-burgundy-600" />
                <span>{formatTime(booking.timeSlot)} ({booking.experience.duration} min)</span>
              </div>

              {/* Guests */}
              <div className="flex items-center gap-3 text-slate-600">
                <Users className="h-5 w-5 text-burgundy-600" />
                <span>{booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}</span>
              </div>
            </div>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-stone-200">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-600">{t('totalPaid')}</span>
                <span className="text-xl font-bold text-burgundy-600">
                  {formatCHF(booking.totalPrice)}
                </span>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Add to Calendar */}
      {isConfirmed && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t('addToCalendar')}</h3>
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
          <h3 className="font-semibold text-slate-900 mb-4">{t('wineryDetails')}</h3>

          <div className="space-y-3">
            <p className="font-medium text-slate-900">{booking.winery.name}</p>

            {/* Address with Google Maps link */}
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
                  {t('getDirections')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Contact */}
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

      {/* Cancellation Policy */}
      <div className="mb-8">
        <CancellationPolicy />
      </div>

      {/* Visitor Details */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('yourDetails')}</h3>
          <div className="space-y-2 text-slate-600">
            <p><span className="font-medium">{t('name')}:</span> {booking.visitorName}</p>
            <p><span className="font-medium">{t('email')}:</span> {booking.visitorEmail}</p>
            <p><span className="font-medium">{t('phone')}:</span> {booking.visitorPhone}</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild variant="outline">
          <Link href={`/experiences/${booking.experience.slug}`}>
            {t('viewExperience')}
          </Link>
        </Button>
        <Button asChild>
          <Link href="/">
            {t('browseMore')}
          </Link>
        </Button>
      </div>

      {/* Email confirmation note */}
      {isConfirmed && (
        <p className="text-center text-sm text-slate-500 mt-8">
          {t('emailConfirmationNote', { email: booking.visitorEmail })}
        </p>
      )}
    </div>
  );
}
