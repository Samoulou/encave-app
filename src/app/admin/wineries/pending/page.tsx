import { db } from '@/server/db';
import { PendingWineriesTable } from '@/components/features/admin/PendingWineriesTable';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

async function getPendingWineries() {
  return db.winery.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { email: true },
      },
    },
  });
}

async function getCommunes() {
  const wineries = await db.winery.findMany({
    where: { status: 'PENDING' },
    select: { commune: true },
    distinct: ['commune'],
  });
  return wineries.map((w) => w.commune).sort();
}

export default async function PendingWineriesPage() {
  const [wineries, communes] = await Promise.all([
    getPendingWineries(),
    getCommunes(),
  ]);

  return (
    <div className="container py-10">
      <div className="mb-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-burgundy-700 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-display-md text-burgundy-700">
            Pending Verifications
          </h1>
          {wineries.length > 0 && (
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-burgundy-600 px-3 text-sm font-semibold text-white">
              {wineries.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-slate-600">
          Review and verify winemaker registrations
        </p>
      </div>

      <PendingWineriesTable wineries={wineries} communes={communes} />
    </div>
  );
}
