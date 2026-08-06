import { cache } from 'react';
import { ExperienceStatus } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Owner-scoped operational context of an experience for the sessions
 * calendar route (P-05 fix round). Complements `getOccurrenceCalendar`
 * (occurrence.queries.ts) with the fields the re-homed day-J tooling
 * needs: `slug` (scanner link), `duration` (session end → check-in /
 * no-show / scan-window gating), `wineryName` (contact-guests mail) and
 * `status` (archived experiences are read-only).
 *
 * The booking-derived `getEventDetail` (ENC-096) that used to live here
 * was deleted when the route was repointed onto the occurrence calendar
 * — its grouping logic has no remaining consumer.
 */
export interface ExperienceOperationalContextDTO {
  id: string;
  title: string;
  slug: string;
  status: ExperienceStatus;
  /** Minutes. */
  duration: number;
  maxCapacity: number;
  wineryName: string;
}

/**
 * Returns null when the experience does not exist or does not belong to
 * a winery owned by `userId` (tenant gate). React.cache only — same
 * request-freshness constraint as the other operational reads.
 */
export const getExperienceOperationalContext = cache(
  async function getExperienceOperationalContext(
    experienceId: string,
    userId: string
  ): Promise<ExperienceOperationalContextDTO | null> {
    const experience = await db.experience.findFirst({
      where: { id: experienceId, winery: { userId } },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        duration: true,
        maxCapacity: true,
        winery: { select: { name: true } },
      },
    });
    if (!experience) return null;

    return {
      id: experience.id,
      title: experience.title,
      slug: experience.slug,
      status: experience.status,
      duration: experience.duration,
      maxCapacity: experience.maxCapacity,
      wineryName: experience.winery.name,
    };
  }
);
