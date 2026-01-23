'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react';
import { getExperienceForPreview } from '@/server/actions/experience';
import { ExperienceHero } from '@/components/features/experience/ExperienceHero';
import { ExperienceGallery } from '@/components/features/experience/ExperienceGallery';
import { ExperienceDetails } from '@/components/features/experience/ExperienceDetails';
import { AvailabilityPreview } from '@/components/features/experience/AvailabilityPreview';
import { WineryInfoCard } from '@/components/features/experience/WineryInfoCard';
import { LocationSection } from '@/components/features/experience/LocationSection';
import { BookingCTA } from '@/components/features/experience/BookingCTA';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/shared/Skeleton';
import type { ExperienceType } from '@prisma/client';

interface ExperiencePreviewData {
  id: string;
  title: string;
  slug: string;
  type: string;
  description: string;
  duration: number;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  coverPhoto: string;
  status: string;
  galleryImages: { id: string; url: string; order: number }[];
  availabilitySlots: { id: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }[];
  winery: {
    id: string;
    name: string;
    slug: string;
    commune: string;
    address: string;
    coverPhoto: string | null;
    latitude: number | null;
    longitude: number | null;
    stripeOnboardingComplete: boolean;
  };
}

export default function ExperiencePreviewPage() {
  const params = useParams();
  const experienceId = params.id as string;
  const [experience, setExperience] = useState<ExperiencePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadExperience() {
      setIsLoading(true);
      setError(null);

      const result = await getExperienceForPreview(experienceId);

      if (result.success) {
        setExperience(result.data);
      } else {
        setError(result.error.message);
      }

      setIsLoading(false);
    }

    loadExperience();
  }, [experienceId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-50">
        <div className="bg-burgundy-600 h-[40vh]">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Experience Not Found</h1>
          <p className="text-slate-600 mb-4">{error || 'Unable to load the experience preview.'}</p>
          <Button asChild>
            <Link href="/dashboard/experiences">Back to Experiences</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isDraft = experience.status === 'DRAFT';

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Preview Mode Banner */}
      <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Preview Mode {isDraft && '- This experience is not published'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/experiences">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/experiences/${experience.id}/edit`}>
                  Edit Experience
                </Link>
              </Button>
              {!isDraft && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/experiences/${experience.slug}`} target="_blank">
                    View Public Page
                    <ExternalLink className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ExperienceHero
        title={experience.title}
        type={experience.type as ExperienceType}
        price={experience.price}
        coverPhoto={experience.coverPhoto}
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
        {isDraft && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This experience is currently a draft and is not visible to visitors. Publish it from your dashboard to make it available for bookings.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Experience Details */}
            <ExperienceDetails
              description={experience.description}
              duration={experience.duration}
              minCapacity={experience.minCapacity}
              maxCapacity={experience.maxCapacity}
            />

            {/* Availability Preview */}
            <AvailabilityPreview slots={experience.availabilitySlots} />

            {/* Gallery */}
            {experience.galleryImages.length > 0 && (
              <ExperienceGallery
                images={experience.galleryImages}
                experienceTitle={experience.title}
              />
            )}

            {/* Location Section */}
            <LocationSection
              address={experience.winery.address}
              commune={experience.winery.commune}
              wineryName={experience.winery.name}
              latitude={experience.winery.latitude}
              longitude={experience.winery.longitude}
            />
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Booking CTA */}
            <BookingCTA
              price={experience.price}
              experienceSlug={experience.slug}
              stripeConnected={experience.winery.stripeOnboardingComplete}
            />

            {/* Winery Info Card */}
            <WineryInfoCard
              name={experience.winery.name}
              slug={experience.winery.slug}
              commune={experience.winery.commune}
              coverPhoto={experience.winery.coverPhoto}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
