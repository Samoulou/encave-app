'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookingSummary } from '@/components/features/booking';
import { CheckoutForm } from '@/components/features/checkout/CheckoutForm';
import { getExperienceForBooking, type ExperienceForBooking } from '@/server/actions/booking';

export default function CheckoutPage() {
  const params = useParams<{ slug: string; locale: string }>();
  const slug = params.slug;
  const t = useTranslations('checkout');
  const searchParams = useSearchParams();

  const [experience, setExperience] = useState<ExperienceForBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get booking params from URL
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const guests = searchParams.get('guests');
  const paymentError = searchParams.get('error');

  // Validate required params
  const guestCount = guests ? parseInt(guests, 10) : null;
  const hasValidParams = date && time && guestCount && guestCount > 0;

  useEffect(() => {
    if (!slug) return;

    setIsLoading(true);
    getExperienceForBooking(slug).then((result) => {
      if (result.success) {
        setExperience(result.data);
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
    });
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" />
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || t('experienceNotFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasValidParams) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t('invalidBookingParams')}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={`/experiences/${slug}/book`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToBooking')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalPrice = experience.price * guestCount;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/experiences/${slug}/book?date=${date}&time=${time}&guests=${guests}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToBooking')}
          </Link>
        </Button>
      </div>

      {/* Payment error alert */}
      {paymentError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {paymentError === 'cancelled' ? t('paymentCancelled') : t('paymentFailed')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Checkout Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('guestDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckoutForm
                experienceId={experience.id}
                wineryId={experience.winery.id}
                date={date}
                time={time}
                guestCount={guestCount}
                totalPrice={totalPrice}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Booking Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              <BookingSummary
                experienceTitle={experience.title}
                wineryName={experience.winery.name}
                date={date}
                time={time}
                guests={guestCount}
                totalPrice={totalPrice}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
