import type { Metadata } from 'next';
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
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b">
        <div className="container py-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Wineries in Valais
          </h1>
          <p className="mt-2 text-slate-600">
            Discover the finest winemakers in the Valais region
          </p>
        </div>
      </div>

      <div className="container py-8">
        {communes.length > 0 && (
          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700">
              Filter by commune:
            </span>
            <Suspense fallback={<div className="h-10 w-[200px] bg-slate-100 rounded animate-pulse" />}>
              <CommuneFilter communes={communes} />
            </Suspense>
          </div>
        )}

        {wineries.length === 0 ? (
          <EmptyState
            title="Winemakers coming soon..."
            description="We're working with local winemakers to bring you amazing experiences. Check back soon!"
            icon={
              <svg
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {wineries.map((winery) => (
              <WineryCard key={winery.id} winery={winery} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
