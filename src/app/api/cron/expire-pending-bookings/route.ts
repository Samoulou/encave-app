import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { subMinutes } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ENC-067 — Cron d'expiration des bookings PENDING_PAYMENT > 30 min.
 *
 * Cible : les bookings dont le client n'a pas finalisé le paiement Stripe
 * dans la fenêtre de 30 min (durée par défaut d'une Checkout Session).
 *
 * Transition : `PENDING_PAYMENT` → `CANCELLED_BY_CLIENT`. Pas de nouveau
 * statut `CANCELLED_BY_SYSTEM` pour éviter de casser les `switch`
 * exhaustifs (cf. ADR-0002 §5). L'origine "expiration" passe par le log
 * Pino structuré.
 *
 * Idempotence : la fenêtre où `status === PENDING_PAYMENT` est unique au
 * niveau row Postgres — un seul run gagne la transition. Si le webhook
 * Stripe arrive en parallèle et flip vers CONFIRMED, l'updateMany ignore
 * la row (le filtre status ne matche plus).
 *
 * Schedule Vercel : `*\/15 * * * *` (toutes les 15 min). Vercel Hobby
 * plafonne à 2 crons et fréquence min = 1/jour — sur Hobby ce cron
 * nécessite l'upgrade Pro. Fallback acceptable : passer à `0 * * * *`
 * (horaire) si Margot reste sur Hobby.
 */
export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const cutoff = subMinutes(new Date(), 30);

  try {
    // Load the bookings about to be released so we can invalidate their
    // experience caches afterwards (the updateMany itself returns only
    // count).
    const toRelease = await db.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        reference: true,
        experience: { select: { slug: true } },
      },
    });

    if (toRelease.length === 0) {
      logInfo('expire-pending-bookings: nothing to release', { cutoff });
      return NextResponse.json({
        success: true,
        expired: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    const result = await db.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
      },
      data: {
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date(),
      },
    });

    // Granular cache invalidation per affected experience. Deduplicate by
    // slug to avoid redundant calls when several bookings target the same
    // experience.
    const slugs: string[] = [];
    for (const b of toRelease) {
      if (!slugs.includes(b.experience.slug)) {
        slugs.push(b.experience.slug);
      }
    }
    for (const slug of slugs) {
      revalidateTag(`experience:${slug}:availability`);
    }

    logInfo('expire-pending-bookings: released', {
      count: result.count,
      cutoff,
      bookingRefs: toRelease.map((b) => b.reference),
    });

    return NextResponse.json({
      success: true,
      expired: result.count,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logError('expire-pending-bookings cron error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
