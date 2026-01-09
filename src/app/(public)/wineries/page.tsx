import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';
import {
  getVerifiedWineries,
  getDistinctCommunes,
} from '@/server/queries/winery.queries';
import { WineryCard } from '@/components/features/winery/WineryCard';
import { CommuneFilter } from '@/components/features/winery/CommuneFilter';
import { EmptyState } from '@/components/shared/EmptyState';

export const metadata: Metadata = {
  title: 'Wineries in Valais | EnCave',
  description:
    'Discover verified winemakers in Valais, Switzerland. Browse our directory of local wineries offering unique wine experiences.',
  openGraph: {
    title: 'Wineries in Valais | EnCave',
    description:
      'Discover verified winemakers in Valais, Switzerland. Browse our directory of local wineries offering unique wine experiences.',
    type: 'website',
  },
};

interface WineriesPageProps {
  searchParams: Promise<{ commune?: string }>;
}

export default async function WineriesPage({
  searchParams,
}: WineriesPageProps) {
  const params = await searchParams;
  const commune = params.commune;
  const [wineries, communes] = await Promise.all([
    getVerifiedWineries(commune),
    getDistinctCommunes(),
  ]);

  return (
    <main id="main-content" className="min-h-screen bg-cream-50">
      {/* Hero Section */}
      <section aria-labelledby="hero-heading" className="relative h-[40vh] min-h-[320px] w-full">
        <Image
          src="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop"
          alt="Vineyards in Valais, Switzerland"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/80 via-burgundy-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="mx-auto max-w-6xl">
            <h1 id="hero-heading" className="font-display text-display-lg text-white">
              Wineries in Valais
            </h1>
            <p className="mt-3 max-w-xl text-lg text-white/90">
              Discover exceptional winemakers in Switzerland&apos;s premier wine region.
              Each winery offers unique experiences rooted in centuries of tradition.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <span className="text-sm font-medium text-slate-600">
            Showing <span className="text-burgundy-700">{wineries.length}</span> winer{wineries.length === 1 ? 'y' : 'ies'}
          </span>
          {communes.length > 0 && (
            <Suspense fallback={<div className="h-11 w-[200px] bg-stone-100 rounded-lg animate-pulse" />}>
              <CommuneFilter communes={communes} />
            </Suspense>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
        {wineries.length === 0 ? (
          <EmptyState
            title="Winemakers coming soon..."
            description="We're working with local winemakers to bring you amazing experiences. Check back soon!"
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {wineries.map((winery, index) => (
              <div
                key={winery.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
              >
                <WineryCard winery={winery} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
