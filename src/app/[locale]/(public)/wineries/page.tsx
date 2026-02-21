import Image from 'next/image';
import { Suspense } from 'react';
import { WineriesContent } from './WineriesContent';
import { Skeleton } from '@/components/shared/Skeleton';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/routing';

interface WineriesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ commune?: string }>;
}

export async function generateMetadata({ params }: WineriesPageProps): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({ locale: locale as Locale, path: 'wineries', namespace: 'wineries' });
}

export default async function WineriesPage({
  searchParams,
}: WineriesPageProps) {
  const [{ commune }, t] = await Promise.all([
    searchParams,
    getTranslations('wineries'),
  ]);

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main id="main-content">
      {/* Hero Section - renders immediately */}
      <section aria-labelledby="hero-heading" className="relative h-[40vh] min-h-[320px] w-full">
        <Image
          src="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop"
          alt={t('heroImageAlt')}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/80 via-burgundy-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="mx-auto max-w-6xl">
            <h1 id="hero-heading" className="font-display text-display-lg text-white">
              {t('title')}
            </h1>
            <p className="mt-3 max-w-xl text-lg text-white/90">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Content streams in when data is ready */}
      <Suspense fallback={<WineriesLoadingState />}>
        <WineriesContent commune={commune} />
      </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function WineriesLoadingState() {
  return (
    <>
      {/* Filter Bar skeleton */}
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-[200px]" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl bg-white shadow-warm">
              <Skeleton className="h-48 w-full" />
              <div className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
