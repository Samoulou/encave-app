import { createId } from '@paralleldrive/cuid2';
import { addHours, subHours } from 'date-fns';
import {
  RequestStatus,
  RequestOfferStatus,
  ScheduledJobStatus,
} from '@prisma/client';
import { db } from '@/server/db';
import { logInfo, logWarn } from '@/lib/logger';
import { assertRequestTransition } from '@/lib/business-rules/request-transitions';
import { assertRequestOfferTransition } from '@/lib/business-rules/offer-transitions';
import {
  REQUEST_SLA_HOURS,
  REQUEST_OFFER_REMINDER_LEAD_HOURS,
  REQUEST_OFFER_REMINDER_JOB_TYPE,
  REQUEST_OFFER_EXPIRY_JOB_TYPE,
  REQUEST_SLA_ESCALATION_JOB_TYPE,
  requestOfferReminderDedupeKey,
  requestOfferExpiryDedupeKey,
  requestSlaEscalationDedupeKey,
} from '@/lib/constants/request';

/** REQ-XXXXXXXX — globally unique, mirrors generateBookingReference(). */
export function generateRequestReference(): string {
  return `REQ-${createId().slice(0, 8).toUpperCase()}`;
}

/**
 * Arm the > 48h SLA escalation job at request creation (email to Sam). One
 * job per request (dedupeKey); cancelled the moment the winery answers.
 */
export async function armRequestSlaEscalationJob(
  requestId: string,
  createdAt: Date
): Promise<void> {
  await db.scheduledJob.createMany({
    data: [
      {
        type: REQUEST_SLA_ESCALATION_JOB_TYPE,
        runAt: addHours(createdAt, REQUEST_SLA_HOURS),
        payload: { requestId },
        dedupeKey: requestSlaEscalationDedupeKey(requestId),
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * Arm the offer lifecycle jobs when an offer is sent: the single reminder
 * (email #10) 24h before expiry, and the auto-closure at expiry. The
 * reminder is skipped when the validity window is too short to hold a
 * meaningful lead (it would fire almost immediately).
 */
export async function armOfferJobs(
  offerId: string,
  expiresAt: Date,
  now: Date = new Date()
): Promise<void> {
  const reminderRunAt = subHours(expiresAt, REQUEST_OFFER_REMINDER_LEAD_HOURS);
  const data = [
    {
      type: REQUEST_OFFER_EXPIRY_JOB_TYPE,
      runAt: expiresAt,
      payload: { requestOfferId: offerId },
      dedupeKey: requestOfferExpiryDedupeKey(offerId),
    },
  ];
  // Only worth a reminder if it lands comfortably before expiry.
  if (reminderRunAt.getTime() > now.getTime() + 60 * 60 * 1000) {
    data.push({
      type: REQUEST_OFFER_REMINDER_JOB_TYPE,
      runAt: reminderRunAt,
      payload: { requestOfferId: offerId },
      dedupeKey: requestOfferReminderDedupeKey(offerId),
    });
  }
  await db.scheduledJob.createMany({ data, skipDuplicates: true });
}

/** Cancel a request's pending SLA job (winery answered). Never touches DONE. */
export async function cancelSlaEscalationJob(requestId: string): Promise<void> {
  await db.scheduledJob.updateMany({
    where: {
      dedupeKey: requestSlaEscalationDedupeKey(requestId),
      status: ScheduledJobStatus.PENDING,
    },
    data: {
      status: ScheduledJobStatus.CANCELLED,
      lastError: 'request_offered',
    },
  });
}

/**
 * Flip offer + request to PAID after the booking is confirmed (webhook).
 * Guarded `updateMany where status` → idempotent on webhook redelivery. A
 * redelivery for an already-PAID offer is a no-op; an offer that expired at
 * the exact moment of payment keeps the booking (money is real) and only
 * logs the mismatch. Never throws on the idempotent paths — the caller runs
 * inside a Stripe webhook whose failure would trigger a retry storm.
 */
export async function flipRequestOfferPaid(
  requestOfferId: string
): Promise<void> {
  const offer = await db.requestOffer.findUnique({
    where: { id: requestOfferId },
    select: { id: true, status: true, requestId: true },
  });
  if (!offer) {
    logWarn('request offer not found on paid flip', {
      action: 'flipRequestOfferPaid',
      requestOfferId,
    });
    return;
  }
  if (offer.status === RequestOfferStatus.PAID) {
    return; // idempotent redelivery
  }
  if (offer.status !== RequestOfferStatus.SENT) {
    // EXPIRED/WITHDRAWN while payment was in flight — the booking is already
    // confirmed (real money), so we keep it and only record the anomaly.
    logWarn('paid offer no longer SENT — booking kept, status not flipped', {
      action: 'flipRequestOfferPaid',
      requestOfferId,
      offerStatus: offer.status,
    });
    return;
  }

  // Validate against the state machines (SENT→PAID, OFFERED→PAID allowed).
  assertRequestOfferTransition(offer.status, RequestOfferStatus.PAID);
  assertRequestTransition(RequestStatus.OFFERED, RequestStatus.PAID);

  await db.$transaction([
    db.requestOffer.updateMany({
      where: { id: offer.id, status: RequestOfferStatus.SENT },
      data: { status: RequestOfferStatus.PAID },
    }),
    db.request.updateMany({
      where: { id: offer.requestId, status: RequestStatus.OFFERED },
      data: { status: RequestStatus.PAID },
    }),
    db.scheduledJob.updateMany({
      where: {
        dedupeKey: {
          in: [
            requestOfferReminderDedupeKey(offer.id),
            requestOfferExpiryDedupeKey(offer.id),
          ],
        },
        status: ScheduledJobStatus.PENDING,
      },
      data: {
        status: ScheduledJobStatus.CANCELLED,
        lastError: 'offer_paid',
      },
    }),
  ]);

  logInfo('request offer paid', {
    action: 'flipRequestOfferPaid',
    requestOfferId,
    requestId: offer.requestId,
  });
}
