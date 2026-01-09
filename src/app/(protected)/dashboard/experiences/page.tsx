import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { ExperiencesList } from '@/components/features/experience/ExperiencesList';
import { ExperiencesSortSelect } from '@/components/features/experience/ExperiencesSortSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Wine } from 'lucide-react';
import type { Prisma } from '@prisma/client';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'status';

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

function getOrderBy(sort: SortOption): Prisma.ExperienceOrderByWithRelationInput {
  switch (sort) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'alphabetical':
      return { title: 'asc' };
    case 'status':
      return { status: 'asc' };
    case 'newest':
    default:
      return { createdAt: 'desc' };
  }
}

export default async function ExperiencesDashboardPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const sort = (params.sort as SortOption) || 'newest';

  // Get winery with experiences
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    include: {
      experiences: {
        orderBy: getOrderBy(sort),
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          duration: true,
          price: true,
          status: true,
          coverPhoto: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!winery) {
    redirect('/onboarding/winery');
  }

  const experiences = winery.experiences;

  return (
    <WineryAccessGuard>
      <div className="container max-w-6xl py-12">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-display-md text-slate-900">
              Your Experiences
            </h1>
            <p className="text-slate-600">
              Create and manage wine experiences for visitors to book
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href="/dashboard/experiences/new">
              <Plus className="h-5 w-5" />
              Create Experience
            </Link>
          </Button>
        </div>

        {/* Experiences List */}
        {experiences.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-burgundy-100">
                <Wine className="h-8 w-8 text-burgundy-600" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                No experiences yet
              </h3>
              <p className="mt-2 max-w-sm text-slate-600">
                Create your first experience to attract visitors and start accepting
                bookings.
              </p>
              <Button asChild className="mt-6 gap-2">
                <Link href="/dashboard/experiences/new">
                  <Plus className="h-4 w-4" />
                  Create Your First Experience
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Sort Controls */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {experiences.length} experience{experiences.length !== 1 ? 's' : ''}
              </p>
              <ExperiencesSortSelect currentSort={sort} />
            </div>

            <ExperiencesList experiences={experiences} />
          </>
        )}
      </div>
    </WineryAccessGuard>
  );
}
