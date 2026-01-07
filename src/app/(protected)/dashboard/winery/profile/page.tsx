import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { WineryProfileForm } from '@/components/features/winery/WineryProfileForm';

export default async function WineryProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get winery with gallery images
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    include: {
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  return (
    <WineryAccessGuard>
      <div className="container py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-burgundy-700">
            Winery Profile
          </h1>
          <p className="mt-2 text-slate-600">
            Manage your winery information and photos
          </p>
          {winery.updatedAt && (
            <p className="mt-1 text-sm text-slate-500">
              Last updated:{' '}
              {new Date(winery.updatedAt).toLocaleDateString('en-CH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <WineryProfileForm
          winery={{
            id: winery.id,
            name: winery.name,
            slug: winery.slug,
            description: winery.description,
            address: winery.address,
            commune: winery.commune,
            phone: winery.phone,
            coverPhoto: winery.coverPhoto,
            galleryImages: winery.galleryImages,
          }}
        />
      </div>
    </WineryAccessGuard>
  );
}
