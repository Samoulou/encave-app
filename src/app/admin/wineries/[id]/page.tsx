import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WineryDetailView } from '@/components/features/admin/WineryDetailView';

interface WineryDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getWinery(id: string) {
  return db.winery.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export default async function WineryDetailPage({ params }: WineryDetailPageProps) {
  const { id } = await params;
  const winery = await getWinery(id);

  if (!winery) {
    notFound();
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <Link
          href="/admin/wineries/pending"
          className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-burgundy-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pending Wineries
        </Link>
        <h1 className="text-3xl font-bold text-burgundy-700">Winery Review</h1>
        <p className="mt-2 text-slate-600">
          Review the winery details and approve or reject the registration
        </p>
      </div>

      <WineryDetailView winery={winery} />
    </div>
  );
}
