import Link from 'next/link';
import { db } from '@/server/db';
import { ExperiencesList } from '@/components/features/experience/ExperiencesList';
import { ExperiencesSortSelect } from '@/components/features/experience/ExperiencesSortSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Wine } from 'lucide-react';
import type { Prisma } from '@prisma/client';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'status';

interface ExperiencesContentProps {
  wineryId: string;
  sort: SortOption;
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

/**
 * Async server component that fetches experiences data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function ExperiencesContent({ wineryId, sort }: ExperiencesContentProps) {
  const experiences = await db.experience.findMany({
    where: { wineryId },
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
  });

  if (experiences.length === 0) {
    return (
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
    );
  }

  return (
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
  );
}
