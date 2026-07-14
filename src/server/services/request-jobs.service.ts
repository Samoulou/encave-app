import type { Prisma } from '@prisma/client';
import { RequestStatus, RequestOfferStatus } from '@prisma/client';
import { db } from '@/server/db';
import { env, getBaseUrl } from '@/lib/env';
import { logError, logInfo } from '@/lib/logger';
import type { Locale as RoutingLocale } from '@/i18n/routing';
import { assertRequestTransition } from '@/lib/business-rules/request-transitions';
import { assertRequestOfferTransition } from '@/lib/business-rules/offer-transitions';
import {
  sendRequestOfferExpiringEmail,
  sendRequestSlaEscalationEmail,
} from '@/server/services/email.service';
import type { ScheduledJobHandlerResult } from '@/server/services/scheduled-jobs.service';

function readStringField(
  payload: Prisma.JsonValue,
  key: string
): string | null {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/**
 * REQUEST_OFFER_REMINDER (P-10 / L-093, email #10): single reminder ~24h
 * before an unpaid offer expires. Guarded by `reminderSentAt` on top of the
 * runner's atomic claim; a send failure throws → retried.
 */
export async function processRequestOfferReminderJob(
  payload: Prisma.JsonValue
): Promise<ScheduledJobHandlerResult> {
  const requestOfferId = readStringField(payload, 'requestOfferId');
  if (!requestOfferId) return { ok: false, skipReason: 'invalid_payload' };

  const offer = await db.requestOffer.findUnique({
    where: { id: requestOfferId },
    select: {
      id: true,
      status: true,
      totalPrice: true,
      expiresAt: true,
      reminderSentAt: true,
      paymentToken: true,
      request: {
        select: {
          clientEmail: true,
          clientName: true,
          locale: true,
          winery: { select: { name: true } },
        },
      },
    },
  });
  if (!offer) return { ok: false, skipReason: 'offer_not_found' };
  if (offer.status !== RequestOfferStatus.SENT) {
    return { ok: false, skipReason: `status_${offer.status.toLowerCase()}` };
  }
  if (offer.reminderSentAt !== null) {
    return { ok: true, note: 'already_reminded' };
  }
  if (offer.expiresAt.getTime() <= Date.now()) {
    return { ok: false, skipReason: 'already_expired' };
  }
  if (!offer.paymentToken) return { ok: false, skipReason: 'no_token' };

  const routingLocale = offer.request.locale.toLowerCase() as RoutingLocale;
  const ok = await sendRequestOfferExpiringEmail(
    offer.request.clientEmail,
    {
      clientName: offer.request.clientName,
      wineryName: offer.request.winery?.name ?? 'EnCave',
      totalPriceCents: offer.totalPrice,
      expiresAt: offer.expiresAt,
      payUrl: `${getBaseUrl()}/${routingLocale}/sur-mesure/offre/${offer.paymentToken}`,
    },
    offer.request.locale
  );
  if (!ok) throw new Error('request_offer_reminder_send_failed');

  // Email is OUT — post-send bookkeeping must never throw (would resend).
  try {
    await db.requestOffer.update({
      where: { id: offer.id },
      data: { reminderSentAt: new Date() },
    });
  } catch (error) {
    logError('request offer reminder post-send bookkeeping failed', error, {
      action: 'processRequestOfferReminderJob',
      requestOfferId: offer.id,
    });
  }
  logInfo('request_offer.reminded', {
    action: 'processRequestOfferReminderJob',
    requestOfferId: offer.id,
  });
  return { ok: true };
}

/**
 * REQUEST_OFFER_EXPIRY (P-10 / L-093): auto-closure of an unpaid offer at
 * its expiry — offer SENT→EXPIRED, request OFFERED→EXPIRED + closedAt.
 * Guarded `updateMany where status` → idempotent; a paid offer is a no-op.
 */
export async function processRequestOfferExpiryJob(
  payload: Prisma.JsonValue
): Promise<ScheduledJobHandlerResult> {
  const requestOfferId = readStringField(payload, 'requestOfferId');
  if (!requestOfferId) return { ok: false, skipReason: 'invalid_payload' };

  const offer = await db.requestOffer.findUnique({
    where: { id: requestOfferId },
    select: { id: true, status: true, requestId: true },
  });
  if (!offer) return { ok: false, skipReason: 'offer_not_found' };
  if (offer.status === RequestOfferStatus.PAID) {
    return { ok: true, note: 'already_paid' };
  }
  if (offer.status !== RequestOfferStatus.SENT) {
    return { ok: false, skipReason: `status_${offer.status.toLowerCase()}` };
  }

  assertRequestOfferTransition(offer.status, RequestOfferStatus.EXPIRED);
  assertRequestTransition(RequestStatus.OFFERED, RequestStatus.EXPIRED);

  await db.$transaction([
    db.requestOffer.updateMany({
      where: { id: offer.id, status: RequestOfferStatus.SENT },
      data: { status: RequestOfferStatus.EXPIRED },
    }),
    db.request.updateMany({
      where: { id: offer.requestId, status: RequestStatus.OFFERED },
      data: { status: RequestStatus.EXPIRED, closedAt: new Date() },
    }),
  ]);

  logInfo('request_offer.expired', {
    action: 'processRequestOfferExpiryJob',
    requestOfferId: offer.id,
  });
  return { ok: true };
}

/**
 * REQUEST_SLA_ESCALATION (P-10 / L-094): a request unanswered > 48h emails
 * Sam. Skipped cleanly if the winery has answered (status ≠ PENDING) or if
 * ADMIN_ALERT_EMAIL is unset — a send failure throws → retried.
 */
export async function processRequestSlaEscalationJob(
  payload: Prisma.JsonValue
): Promise<ScheduledJobHandlerResult> {
  const requestId = readStringField(payload, 'requestId');
  if (!requestId) return { ok: false, skipReason: 'invalid_payload' };

  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      reference: true,
      status: true,
      clientName: true,
      clientEmail: true,
      guestCount: true,
      createdAt: true,
      winery: { select: { name: true } },
    },
  });
  if (!request) return { ok: false, skipReason: 'request_not_found' };
  if (request.status !== RequestStatus.PENDING) {
    return { ok: false, skipReason: 'answered_or_closed' };
  }
  if (!env.ADMIN_ALERT_EMAIL) {
    return { ok: false, skipReason: 'no_admin_email' };
  }

  const ok = await sendRequestSlaEscalationEmail(env.ADMIN_ALERT_EMAIL, {
    wineryName: request.winery?.name ?? 'EnCave',
    clientName: request.clientName,
    clientEmail: request.clientEmail,
    requestReference: request.reference,
    guestCount: request.guestCount,
    createdAt: request.createdAt,
    inboxUrl: `${getBaseUrl()}/fr/dashboard/demandes`,
  });
  if (!ok) throw new Error('request_sla_escalation_send_failed');

  logInfo('request.sla_escalated', {
    action: 'processRequestSlaEscalationJob',
    requestId: request.id,
  });
  return { ok: true };
}
