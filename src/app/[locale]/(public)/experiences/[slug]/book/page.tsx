import { notFound, redirect } from 'next/navigation';
import { getExperienceForBooking } from '@/server/actions/booking';
import { BookingWidget } from '@/components/features/booking/BookingWidget';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

interface BookingPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: BookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getExperienceForBooking(slug);

  if (!result.success) {
    return { title: 'Book Experience | EnCave' };
  }

  return {
    title: `Book ${result.data.title} | EnCave`,
    description: `Book your ${result.data.title} experience with ${result.data.winery.name}`,
  };
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params;
  const t = await getTranslations('booking');

  const result = await getExperienceForBooking(slug);

  if (!result.success) {
    notFound();
  }

  const experience = result.data;

  // If winery hasn't completed Stripe onboarding, redirect back
  if (!experience.winery.stripeOnboardingComplete) {
    redirect(`/experiences/${slug}`);
  }

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Experiences', href: '/experiences' },
    { label: experience.title, href: `/experiences/${slug}` },
    { label: t('bookNow') },
  ];

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="border-b border-stone-200/60 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 lg:px-8">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8 lg:py-12">
        <BookingWidget experience={experience} />
      </div>
    </div>
  );
}
