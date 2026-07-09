import { db } from '@/server/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WineryDetailView } from '@/components/features/admin/WineryDetailView';
import { AdminSuspensionControls } from '@/components/features/admin/AdminSuspensionControls';
import { WineryMonetizationPanel } from '@/components/features/admin/WineryMonetizationPanel';
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
    namespace: 'metadata.admin.wineryDetail',
    noIndex: true,
  });
}

interface WineryDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getWinery(id: string) {
  return db.winery.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          suspendedAt: true,
        },
      },
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export default async function WineryDetailPage({
  params,
}: WineryDetailPageProps) {
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
          className="mb-4 inline-flex items-center text-sm text-slate-600 transition-colors hover:text-burgundy-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pending Queue
        </Link>
        <h1 className="font-display text-display-md text-burgundy-700">
          Winery Review
        </h1>
        <p className="mt-2 text-slate-600">
          Review the winery details and approve or reject the registration
        </p>
      </div>

      <WineryDetailView winery={winery} />

      <div className="mt-6 space-y-4">
        <WineryMonetizationPanel
          wineryId={winery.id}
          plan={winery.plan}
          commissionRate={winery.commissionRate}
        />
        <AdminSuspensionControls
          targetId={winery.id}
          targetType="winery"
          mode={winery.status === 'SUSPENDED' ? 'reinstate' : 'suspend'}
          label={
            winery.status === 'SUSPENDED'
              ? 'Reinstate this winery'
              : 'Suspend this winery'
          }
        />
        <AdminSuspensionControls
          targetId={winery.user.id}
          targetType="user"
          mode={winery.user.suspendedAt ? 'reinstate' : 'suspend'}
          label={
            winery.user.suspendedAt
              ? 'Reinstate winery owner account'
              : 'Suspend winery owner account'
          }
        />
      </div>
    </div>
  );
}
