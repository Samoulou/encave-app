import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { logInfo } from '@/lib/logger';

/**
 * Idempotency guard shared by all Stripe webhook routes (checkout + connect).
 * An event is processed at most once; FAILED events are eligible for retry
 * when Stripe redelivers them.
 */
export async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.stripeEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: 'PROCESSING',
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await db.stripeEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { status: true },
      });

      if (existing?.status === 'FAILED') {
        const retry = await db.stripeEvent.updateMany({
          where: { stripeEventId: event.id, status: 'FAILED' },
          data: { status: 'PROCESSING', errorMessage: null },
        });
        return retry.count === 1;
      }

      logInfo('Duplicate Stripe event skipped', {
        eventId: event.id,
        eventType: event.type,
        status: existing?.status,
      });
      return false;
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
