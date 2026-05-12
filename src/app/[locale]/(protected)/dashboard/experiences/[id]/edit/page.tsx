import dynamic from 'next/dynamic';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect, notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Skeleton } from '@/components/shared/Skeleton';
import { Calendar } from 'lucide-react';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
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
    namespace: 'metadata.dashboard.editExperience',
    noIndex: true,
  });
}

// Dynamic imports for heavy form components
const EditExperienceForm = dynamic(
  () =>
    import('@/components/features/experience/EditExperienceForm').then(
      (mod) => mod.EditExperienceForm
    ),
  {
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    ),
  }
);

const AvailabilityScheduleBuilder = dynamic(
  () =>
    import('@/components/features/experience/AvailabilityScheduleBuilder').then(
      (mod) => mod.AvailabilityScheduleBuilder
    ),
  {
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  }
);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExperiencePage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const { id } = await params;

  // Get winery
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });

  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  if (winery.status !== 'VERIFIED') {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  // Get experience
  const experience = await db.experience.findFirst({
    where: {
      id,
      wineryId: winery.id,
    },
    include: {
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!experience) {
    notFound();
  }

  const [t, tNav] = await Promise.all([
    getTranslations('experience'),
    getTranslations('nav'),
  ]);

  // Transform for form
  const experienceData = {
    id: experience.id,
    title: experience.title,
    type: experience.type,
    description: experience.description,
    duration: experience.duration,
    price: experience.price / 100, // Convert cents to CHF
    minCapacity: experience.minCapacity,
    maxCapacity: experience.maxCapacity,
    coverPhoto: experience.coverPhoto,
    galleryImages: experience.galleryImages.map((img) => ({
      id: img.id,
      url: img.url,
      order: img.order,
    })),
  };

  return (
    <WineryAccessGuard>
      <div className="container max-w-4xl py-12">
        {/* Page Header */}
        <div className="mb-10">
          <Breadcrumb
            className="mb-4"
            items={[
              { label: tNav('dashboard'), href: '/dashboard' },
              { label: tNav('experiences'), href: '/dashboard/experiences' },
              { label: t('editTitle') },
            ]}
          />

          <div className="space-y-3">
            <h1 className="font-display text-display-md text-slate-900">
              {t('editTitle')}
            </h1>
            <p className="text-slate-600">{t('editSubtitle')}</p>
          </div>
        </div>

        <EditExperienceForm experience={experienceData} />

        {/* Availability Section */}
        <section className="mt-12 space-y-6">
          <div className="flex items-start gap-4 border-b border-stone-200 pb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                {t('availabilitySchedule')}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('availabilityScheduleSubtitle')}
              </p>
            </div>
          </div>

          <AvailabilityScheduleBuilder
            experienceId={experience.id}
            experienceDuration={experience.duration}
            experienceStatus={experience.status}
          />
        </section>
      </div>
    </WineryAccessGuard>
  );
}
