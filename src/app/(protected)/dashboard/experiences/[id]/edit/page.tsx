import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { EditExperienceForm } from '@/components/features/experience/EditExperienceForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExperiencePage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  // Get winery
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  if (winery.status !== 'VERIFIED') {
    redirect('/dashboard');
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
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-slate-600 hover:text-slate-900"
          >
            <Link href="/dashboard/experiences" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Experiences
            </Link>
          </Button>

          <div className="space-y-3">
            <h1 className="font-display text-display-md text-slate-900">
              Edit Experience
            </h1>
            <p className="text-slate-600">
              Update your experience details. Changes will be saved immediately.
            </p>
          </div>
        </div>

        <EditExperienceForm experience={experienceData} />
      </div>
    </WineryAccessGuard>
  );
}
