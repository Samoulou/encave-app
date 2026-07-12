import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { ExperienceStatus } from '@prisma/client';
import { db } from '@/server/db';
import { publiclyVisibleWineryWhere } from '@/lib/business-rules/winery-visibility';

/**
 * Read-only queries for the gift-card public surfaces (P-09). The
 * catalogue list is ISR-cached under the 'experiences' tag (same
 * invalidation as the rest of the public tree); the code lookup is
 * request-deduped only — a card's balance must never be stale.
 */

export interface GiftableExperience {
  id: string;
  title: string;
  /** Price in cents (single ticket — the nominatif gift value). */
  price: number;
  wineryName: string;
}

/**
 * Published experiences of publicly-visible wineries, for the "gift a
 * specific experience" picker. Capped — a launch-scale catalogue fits;
 * a larger one would need a searchable picker (noted for a follow-up).
 */
export const getGiftableExperiences = cache(
  unstable_cache(
    async (): Promise<GiftableExperience[]> => {
      const experiences = await db.experience.findMany({
        where: {
          status: ExperienceStatus.PUBLISHED,
          winery: publiclyVisibleWineryWhere,
        },
        select: {
          id: true,
          title: true,
          price: true,
          winery: { select: { name: true } },
        },
        orderBy: { title: 'asc' },
        take: 200,
      });
      return experiences.map((e) => ({
        id: e.id,
        title: e.title,
        price: e.price,
        wineryName: e.winery.name,
      }));
    },
    ['giftable-experiences'],
    {
      revalidate: 3600,
      tags: ['experiences'],
    }
  )
);

export interface PublicGiftCardView {
  code: string;
  status: 'ACTIVE' | 'DISABLED' | 'EXPIRED';
  initialAmount: number;
  balance: number;
  expiresAt: Date;
  recipientName: string | null;
  purchaserName: string | null;
  isExpired: boolean;
}

/**
 * Public view of a gift card by code (the /bon/[code] page). Never
 * cached — the balance is authoritative. Returns null when unknown.
 */
export const getGiftCardByCode = cache(
  async (code: string): Promise<PublicGiftCardView | null> => {
    const normalized = code.toUpperCase().replace(/[\s-]/g, '');
    const giftCard = await db.giftCard.findUnique({
      where: { code: normalized },
      select: {
        code: true,
        status: true,
        initialAmount: true,
        balance: true,
        expiresAt: true,
        recipientName: true,
        purchaserName: true,
      },
    });
    if (!giftCard) return null;
    return {
      ...giftCard,
      isExpired: giftCard.expiresAt.getTime() < Date.now(),
    };
  }
);
