import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { db } from '@/server/db';

/**
 * Collective-event participant reads (P-11 / L-100, L-101).
 *
 * Public grid vs. owner-managed panel vs. winery picker. The public grid is
 * cached under the 'experiences' tag (same purge as the fiche); the owner
 * reads are React.cache only (they cross a tenant gate, never a public one).
 */

export interface EventParticipantPublicDTO {
  id: string;
  wineryName: string;
  winerySlug: string;
  commune: string;
  description: string | null;
  /** Per-event logo, or the winery cover photo as a fallback. */
  logoUrl: string | null;
}

/**
 * Public participants of a collective event, ordered for the fiche grid.
 *
 * Visibility gate (D1, souple): the participant is shown when its winery is
 * VERIFIED and its owner is not suspended — it does NOT require the
 * participant to have its own published experience (a participating cave may
 * only cater the event). A cave suspended AFTER being added disappears here
 * automatically.
 */
export const getEventParticipants = cache(
  unstable_cache(
    async (experienceId: string): Promise<EventParticipantPublicDTO[]> => {
      const rows = await db.eventParticipant.findMany({
        where: {
          experienceId,
          winery: { status: 'VERIFIED', user: { suspendedAt: null } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          description: true,
          logo: true,
          winery: {
            select: {
              name: true,
              slug: true,
              commune: true,
              coverPhoto: true,
            },
          },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        wineryName: row.winery.name,
        winerySlug: row.winery.slug,
        commune: row.winery.commune,
        description: row.description,
        logoUrl: row.logo ?? row.winery.coverPhoto,
      }));
    },
    ['event-participants-v1'],
    { revalidate: 300, tags: ['experiences'] }
  )
);

export interface ManageableParticipantDTO {
  id: string;
  wineryId: string;
  wineryName: string;
  commune: string;
  description: string | null;
  logoUrl: string | null;
  order: number;
  /** false when the winery is suspended/unverified AFTER being added. */
  wineryVisible: boolean;
}

/**
 * Participants of a collective event for the organizer's management panel.
 * Owner-gated (`winery.userId`); returns [] when the experience is not the
 * caller's — never leaks another organizer's roster.
 */
export const getManageableParticipants = cache(
  async (
    experienceId: string,
    userId: string
  ): Promise<ManageableParticipantDTO[]> => {
    const experience = await db.experience.findFirst({
      where: { id: experienceId, winery: { userId } },
      select: { id: true },
    });
    if (!experience) return [];

    const rows = await db.eventParticipant.findMany({
      where: { experienceId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        wineryId: true,
        description: true,
        logo: true,
        order: true,
        winery: {
          select: {
            name: true,
            commune: true,
            coverPhoto: true,
            status: true,
            user: { select: { suspendedAt: true } },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      wineryId: row.wineryId,
      wineryName: row.winery.name,
      commune: row.winery.commune,
      description: row.description,
      logoUrl: row.logo ?? row.winery.coverPhoto,
      order: row.order,
      wineryVisible:
        row.winery.status === 'VERIFIED' &&
        row.winery.user.suspendedAt === null,
    }));
  }
);

export interface SelectableWineryDTO {
  id: string;
  name: string;
  commune: string;
}

/**
 * VERIFIED, non-suspended wineries the organizer can add as participants
 * (excluding itself). Loaded server-side and filtered client-side in the
 * panel picker — MVP winery volumes make a full list cheaper than a
 * rate-limited search endpoint.
 */
export const getSelectableWineriesForEvent = cache(
  async (organizerWineryId: string): Promise<SelectableWineryDTO[]> => {
    return db.winery.findMany({
      where: {
        status: 'VERIFIED',
        user: { suspendedAt: null },
        id: { not: organizerWineryId },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, commune: true },
    });
  }
);
