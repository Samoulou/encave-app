import { ExperienceStatus, ExperienceType } from '@prisma/client';
import { db } from '@/server/db';
import {
  SUR_MESURE_EXPERIENCE_SLUG,
  SUR_MESURE_DEFAULT_DURATION_MIN,
  SUR_MESURE_COVER_PHOTO,
  REQUEST_GUEST_MAX,
} from '@/lib/constants/request';

/**
 * Hidden per-winery holder experience for sur-mesure bookings (P-10,
 * decision Option A). A paid offer books against this row so the ticket/QR,
 * scan, J-1 reminder, confirmation and cancellation all reuse the standard
 * booking code — the booking is a fully real row.
 *
 * Always DRAFT (excluded from every PUBLISHED-gated public surface) and
 * `isCustom = true` (filters the two winemaker lists that show DRAFT rows).
 * Singleton per winery via the existing @@unique([wineryId, slug]); the
 * upsert is idempotent — never overwrites an existing holder.
 *
 * The `price` is 0: a sur-mesure booking sets `totalPrice` explicitly from
 * the offer, never `price × guests`.
 */
export async function getOrCreateSurMesureExperience(
  wineryId: string
): Promise<{ id: string; title: string }> {
  const experience = await db.experience.upsert({
    where: {
      wineryId_slug: { wineryId, slug: SUR_MESURE_EXPERIENCE_SLUG },
    },
    update: {},
    create: {
      wineryId,
      title: 'Offre sur-mesure',
      slug: SUR_MESURE_EXPERIENCE_SLUG,
      description:
        'Prestation sur-mesure organisée directement avec la cave (US-240).',
      type: ExperienceType.EVENT,
      duration: SUR_MESURE_DEFAULT_DURATION_MIN,
      price: 0,
      minCapacity: 1,
      maxCapacity: REQUEST_GUEST_MAX,
      coverPhoto: SUR_MESURE_COVER_PHOTO,
      status: ExperienceStatus.DRAFT,
      isCustom: true,
    },
    select: { id: true, title: true },
  });
  return experience;
}
