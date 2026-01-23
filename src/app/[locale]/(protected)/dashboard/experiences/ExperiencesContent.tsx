import { db } from '@/server/db';
import { ExperienceFilters, type FilterStatus } from '@/components/features/experience/ExperienceFilters';
import { ExperienceManagementCard } from '@/components/features/experience/ExperienceManagementCard';
import { CreateExperienceCard } from '@/components/features/experience/CreateExperienceCard';
import { ExperiencesPagination } from '@/components/features/experience/ExperiencesPagination';
import type { Prisma, ExperienceStatus } from '@prisma/client';

const ITEMS_PER_PAGE = 11; // 11 + 1 create card = 12 total in grid

interface ExperiencesContentProps {
  wineryId: string;
  filter: FilterStatus;
  search: string;
  page: number;
}

function getStatusFilter(filter: FilterStatus): ExperienceStatus | undefined {
  switch (filter) {
    case 'published':
      return 'PUBLISHED';
    case 'drafts':
      return 'DRAFT';
    case 'archived':
      return 'ARCHIVED';
    default:
      return undefined;
  }
}

/**
 * Async server component that fetches experiences data.
 * Designed to be wrapped in Suspense for streaming/progressive loading.
 */
export async function ExperiencesContent({
  wineryId,
  filter,
  search,
  page,
}: ExperiencesContentProps) {
  const statusFilter = getStatusFilter(filter);

  // Build where clause
  const where: Prisma.ExperienceWhereInput = {
    wineryId,
    ...(statusFilter && { status: statusFilter }),
    ...(search && {
      title: { contains: search, mode: 'insensitive' },
    }),
  };

  // Get counts for filter badges (run in parallel)
  const [experiences, totalCount, publishedCount, draftsCount, archivedCount] =
    await Promise.all([
      db.experience.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * ITEMS_PER_PAGE,
        take: ITEMS_PER_PAGE,
        select: {
          id: true,
          title: true,
          duration: true,
          price: true,
          maxCapacity: true,
          status: true,
          coverPhoto: true,
        },
      }),
      db.experience.count({ where }),
      db.experience.count({ where: { wineryId, status: 'PUBLISHED' } }),
      db.experience.count({ where: { wineryId, status: 'DRAFT' } }),
      db.experience.count({ where: { wineryId, status: 'ARCHIVED' } }),
    ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col gap-8">
      {/* Filters & Search */}
      <ExperienceFilters
        publishedCount={publishedCount}
        draftsCount={draftsCount}
        archivedCount={archivedCount}
      />

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {experiences.map((experience) => (
          <ExperienceManagementCard key={experience.id} experience={experience} />
        ))}

        {/* Always show create card on first page when not filtering */}
        {page === 1 && <CreateExperienceCard />}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <ExperiencesPagination currentPage={page} totalPages={totalPages} />
      )}
    </div>
  );
}
