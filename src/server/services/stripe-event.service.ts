import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { logInfo } from '@/lib/logger';

/**
 * A PROCESSING StripeEvent older than this was abandoned mid-handler (function
 * timeout / OOM / kill between claim and mark) — reclaim it so Stripe
 * redeliveries aren't dropped forever. MUST stay strictly greater than the
 * webhook routes' max run duration, or a live run could be reclaimed and
 * double-processed.
 */
export const STALE_STRIPE_EVENT_MINUTES = 15;

/**
 * Outcome of a claim attempt:
 *  - `claimed`     → this delivery owns the event and MUST process it;
 *  - `duplicate`   → already PROCESSED — acknowledge with a 2xx;
 *  - `in_progress` → another delivery holds a live (non-stale) PROCESSING
 *    claim. The caller MUST answer with a non-2xx: a 2xx would tell Stripe
 *    the event is delivered, so if that other run then dies (timeout / OOM /
 *    a DB blip in the FAILED marker) no redelivery would ever come back to
 *    hit the stale reclaim below — the paid booking / gift card would be
 *    lost. With a non-2xx Stripe keeps retrying until the event is either
 *    PROCESSED (→ `duplicate`) or stale (→ reclaimed).
 */
export type StripeEventClaim = 'claimed' | 'duplicate' | 'in_progress';

/**
 * Idempotency guard shared by all Stripe webhook routes (checkout + connect).
 * An event is processed at most once; FAILED events are eligible for retry
 * when Stripe redelivers them, and a PROCESSING row abandoned mid-handler is
 * reclaimed after STALE_STRIPE_EVENT_MINUTES so a timed-out mint/confirm still
 * completes on a redelivery instead of being lost.
 */
export async function claimStripeEvent(
  event: Stripe.Event
): Promise<StripeEventClaim> {
  try {
    await db.stripeEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: 'PROCESSING',
      },
    });
    return 'claimed';
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await db.stripeEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { status: true },
      });

      if (existing?.status === 'PROCESSED') {
        logInfo('Duplicate Stripe event skipped', {
          eventId: event.id,
          eventType: event.type,
          status: existing.status,
        });
        return 'duplicate';
      }

      if (existing?.status === 'FAILED') {
        const retry = await db.stripeEvent.updateMany({
          where: { stripeEventId: event.id, status: 'FAILED' },
          data: { status: 'PROCESSING', errorMessage: null },
        });
        if (retry.count === 1) return 'claimed';
        // A concurrent redelivery won the FAILED → PROCESSING retry.
      }

      // Stale PROCESSING reclaim: a handler killed between claim and mark
      // (function timeout / OOM) leaves the row PROCESSING forever, so every
      // Stripe redelivery is dropped and the paid gift/booking is never
      // processed. Reclaim via a CAS on updatedAt (the @updatedAt bump makes a
      // concurrent second reclaim lose), then let this delivery retry.
      if (existing?.status === 'PROCESSING') {
        const staleBefore = new Date(
          Date.now() - STALE_STRIPE_EVENT_MINUTES * 60 * 1000
        );
        const reclaimed = await db.stripeEvent.updateMany({
          where: {
            stripeEventId: event.id,
            status: 'PROCESSING',
            updatedAt: { lt: staleBefore },
          },
          data: { errorMessage: 'reclaimed_stale_processing' },
        });
        if (reclaimed.count === 1) {
          logInfo('Reclaimed stale PROCESSING Stripe event', {
            eventId: event.id,
            eventType: event.type,
          });
          return 'claimed';
        }
      }

      // Another delivery is processing this event right now (or its fate is
      // unknown): never acknowledge — ask Stripe to redeliver.
      logInfo('Stripe event already in progress — redelivery requested', {
        eventId: event.id,
        eventType: event.type,
        status: existing?.status,
      });
      return 'in_progress';
    }

    throw error;
  }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await db.stripeEvent.update({
    where: { stripeEventId: eventId },
    data: { status: 'PROCESSED', errorMessage: null },
  });
}

export async function markStripeEventFailed(
  eventId: string,
  error: unknown
): Promise<void> {
  // P-16 (WS-E, L-184): every failed webhook event is a money-path
  // incident — push it to Sentry (alert rule on area:stripe-webhook)
  // instead of waiting for someone to read the StripeEvent table. Both
  // webhook routes (checkout + connect) funnel their processing errors
  // through here.
  Sentry.captureException(error, {
    tags: { area: 'stripe-webhook' },
    extra: { stripeEventId: eventId },
  });
  await db.stripeEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
}
