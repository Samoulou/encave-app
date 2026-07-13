'use server';

import crypto from 'crypto';
import { headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { addDays, addMinutes } from 'date-fns';
import type Stripe from 'stripe';
import { createId } from '@paralleldrive/cuid2';
import {
  BookingStatus,
  Locale,
  RequestStatus,
  RequestOfferStatus,
  WineryStatus,
} from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { getBaseUrl } from '@/lib/env';
import type { ActionResult, ErrorCode } from '@/types/actions';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  checkRateLimit,
  getClientIp,
  REQUEST_RATE_LIMIT,
  BOOKING_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { logError, logInfo } from '@/lib/logger';
import {
  getEffectiveCommissionRate,
  computeCommissionCents,
} from '@/lib/business-rules/commission';
import { getPlatformCommissionRate } from '@/server/services/payment.service';
import { assertRequestTransition } from '@/lib/business-rules/request-transitions';
import { getOrCreateSurMesureExperience } from '@/server/services/sur-mesure-experience.service';
import {
  generateRequestReference,
  armRequestSlaEscalationJob,
  armOfferJobs,
  cancelSlaEscalationJob,
} from '@/server/services/request.service';
import {
  sendRequestSubmittedEmail,
  sendRequestNewCustomEmail,
  sendRequestOfferReceivedEmail,
} from '@/server/services/email.service';
import {
  createRequestSchema,
  composeOfferSchema,
  offerCheckoutSchema,
} from '@/lib/validators/request';
import { REQUESTS_CACHE_TAG } from '@/lib/constants/request';
import { STRIPE_SESSION_DURATION_MINUTES } from '@/lib/constants/booking-hold';

function toPrismaLocale(locale: string | undefined): Locale {
  switch (locale) {
    case 'de':
      return Locale.DE;
    case 'en':
      return Locale.EN;
    default:
      return Locale.FR;
  }
}

function routingPath(locale: Locale): string {
  return locale.toLowerCase();
}

/**
 * Create a sur-mesure request (P-10 / L-090). Public (guest), so flag-gated,
 * rate-limited per IP and safeParsed. A winery is mandatory at launch. Sends
 * the client accusé (#8) + the winery notification (#15), and arms the > 48h
 * SLA escalation job. Email failures are logged, never fatal — the request
 * row is the source of truth and also appears in the winery inbox.
 */
export async function createRequestAction(
  input: unknown
): Promise<ActionResult<{ requestReference: string }>> {
  try {
    if (!(await isFlagEnabled('REQUESTS'))) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Requests are not available' },
      };
    }

    const ip = getClientIp(await headers());
    const rateLimit = await checkRateLimit(`request:${ip}`, REQUEST_RATE_LIMIT);
    if (!rateLimit.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
        },
      };
    }

    const parsed = createRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
      };
    }
    const data = parsed.data;

    const winery = await db.winery.findUnique({
      where: { id: data.wineryId },
      select: {
        id: true,
        status: true,
        name: true,
        email: true,
        user: { select: { name: true, preferredLocale: true } },
      },
    });
    if (!winery || winery.status !== WineryStatus.VERIFIED) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery is not available' },
      };
    }

    const locale = toPrismaLocale(data.locale);
    const desiredDate =
      data.desiredDate && data.desiredDate.length > 0
        ? new Date(data.desiredDate)
        : null;

    const request = await db.request.create({
      data: {
        reference: generateRequestReference(),
        status: RequestStatus.PENDING,
        wineryId: winery.id,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone ? data.clientPhone : null,
        desiredDate,
        guestCount: data.guestCount,
        budget: data.budgetCents ?? null,
        description: data.description,
        locale,
      },
      select: { id: true, reference: true, createdAt: true },
    });

    await armRequestSlaEscalationJob(request.id, request.createdAt);

    const clientOk = await sendRequestSubmittedEmail(
      data.clientEmail,
      {
        clientName: data.clientName,
        wineryName: winery.name,
        guestCount: data.guestCount,
        desiredDate,
        requestReference: request.reference,
      },
      locale
    );
    if (!clientOk) {
      logError('request accusé email (#8) failed', undefined, {
        action: 'createRequestAction',
        requestId: request.id,
      });
    }
    const wineryOk = await sendRequestNewCustomEmail(
      winery.email,
      {
        wineryId: winery.id,
        winemakerName: winery.user.name ?? winery.name,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone ? data.clientPhone : null,
        guestCount: data.guestCount,
        desiredDate,
        budgetCents: data.budgetCents ?? null,
        description: data.description,
        requestReference: request.reference,
        inboxUrl: `${getBaseUrl()}/${routingPath(winery.user.preferredLocale)}/dashboard/demandes`,
      },
      winery.user.preferredLocale
    );
    if (!wineryOk) {
      logError('request notification email (#15) failed', undefined, {
        action: 'createRequestAction',
        requestId: request.id,
      });
    }

    revalidateTag(REQUESTS_CACHE_TAG);
    logInfo('request.created', {
      action: 'createRequestAction',
      requestId: request.id,
      wineryId: winery.id,
    });
    return { success: true, data: { requestReference: request.reference } };
  } catch (error) {
    logError('createRequestAction error', error, {
      action: 'createRequestAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send your request' },
    };
  }
}

type OfferGate =
  | {
      ok: true;
      winery: { id: string; slug: string; name: string };
    }
  | {
      ok: false;
      failure: { success: false; error: { code: ErrorCode; message: string } };
    };

async function offerActionGate(): Promise<OfferGate> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      },
    };
  }
  if (!(await isFlagEnabled('REQUESTS'))) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'FORBIDDEN', message: 'This feature is not available' },
      },
    };
  }
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, slug: true, name: true },
  });
  if (!winery) {
    return {
      ok: false,
      failure: {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      },
    };
  }
  return { ok: true, winery };
}

/**
 * Compose and send an offer for a request (P-10 / L-091). Winemaker-only,
 * tenant-checked (the request must belong to the caller's winery). Creates
 * the offer (SENT) with a capability token, moves the request PENDING→OFFERED,
 * cancels the SLA job, arms the reminder + expiry jobs, and emails the client
 * (#9) with the payment link. Price is all-in — no service fee (decision Sam).
 */
export async function composeRequestOfferAction(
  input: unknown
): Promise<ActionResult<{ offerId: string }>> {
  try {
    const gate = await offerActionGate();
    if (!gate.ok) return gate.failure;

    const parsed = composeOfferSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid offer data' },
      };
    }
    const data = parsed.data;

    const request = await db.request.findUnique({
      where: { id: data.requestId },
      select: {
        id: true,
        status: true,
        wineryId: true,
        clientEmail: true,
        clientName: true,
        guestCount: true,
        locale: true,
      },
    });
    if (!request || request.wineryId !== gate.winery.id) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Request not found' },
      };
    }
    if (request.status !== RequestStatus.PENDING) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'This request already has an offer or is closed',
        },
      };
    }

    // Validate the request transition before writing (never bypass the machine).
    assertRequestTransition(RequestStatus.PENDING, RequestStatus.OFFERED);

    const paymentToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = addDays(new Date(), data.validityDays);

    const offer = await db.$transaction(async (tx) => {
      // Guarded move — a concurrent compose loses the claim (count 0).
      const moved = await tx.request.updateMany({
        where: { id: request.id, status: RequestStatus.PENDING },
        data: { status: RequestStatus.OFFERED },
      });
      if (moved.count !== 1) {
        throw new Error('REQUEST_RACE');
      }
      const created = await tx.requestOffer.create({
        data: {
          requestId: request.id,
          status: RequestOfferStatus.SENT,
          message: data.message,
          totalPrice: data.totalPriceCents,
          scheduledDate: new Date(data.scheduledDate),
          scheduledStartTime: data.scheduledStartTime,
          expiresAt,
          paymentToken,
        },
        select: { id: true },
      });
      return created;
    });

    await Promise.all([
      cancelSlaEscalationJob(request.id),
      armOfferJobs(offer.id, expiresAt),
    ]);

    const emailOk = await sendRequestOfferReceivedEmail(
      request.clientEmail,
      {
        clientName: request.clientName,
        wineryName: gate.winery.name,
        message: data.message,
        totalPriceCents: data.totalPriceCents,
        scheduledDate: new Date(data.scheduledDate),
        scheduledStartTime: data.scheduledStartTime,
        guestCount: request.guestCount,
        expiresAt,
        payUrl: `${getBaseUrl()}/${routingPath(request.locale)}/sur-mesure/offre/${paymentToken}`,
      },
      request.locale
    );
    if (!emailOk) {
      logError('request offer email (#9) failed', undefined, {
        action: 'composeRequestOfferAction',
        requestId: request.id,
        offerId: offer.id,
      });
    }

    revalidateTag(REQUESTS_CACHE_TAG);
    logInfo('request_offer.sent', {
      action: 'composeRequestOfferAction',
      requestId: request.id,
      offerId: offer.id,
    });
    return { success: true, data: { offerId: offer.id } };
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_RACE') {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'This request was just updated' },
      };
    }
    logError('composeRequestOfferAction error', error, {
      action: 'composeRequestOfferAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send the offer' },
    };
  }
}

/**
 * Pay an offer via its tokenized link (P-10 / L-092). Public — reached from
 * email #9, so flag-gated + rate-limited. Creates (or reuses) ONE
 * PENDING_PAYMENT booking against the hidden sur-mesure holder experience,
 * then a destination-charge Checkout Session: application_fee = the winery's
 * tier commission on the all-in price, no service fee. The existing checkout
 * webhook confirms the booking + emits the ticket; the request_offer branch
 * flips the offer/request to PAID.
 */
export async function createRequestOfferCheckout(
  input: unknown
): Promise<ActionResult<{ checkoutUrl: string }>> {
  try {
    if (!(await isFlagEnabled('REQUESTS'))) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Requests are not available' },
      };
    }

    const ip = getClientIp(await headers());
    const rateLimit = await checkRateLimit(
      `offerpay:${ip}`,
      BOOKING_RATE_LIMIT
    );
    if (!rateLimit.success) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts.' },
      };
    }

    const parsed = offerCheckoutSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payment link' },
      };
    }

    const offer = await db.requestOffer.findUnique({
      where: { paymentToken: parsed.data.token },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        expiresAt: true,
        scheduledDate: true,
        scheduledStartTime: true,
        bookingId: true,
        request: {
          select: {
            clientEmail: true,
            clientName: true,
            clientPhone: true,
            guestCount: true,
            locale: true,
            winery: {
              select: {
                id: true,
                name: true,
                status: true,
                stripeAccountId: true,
                stripeOnboardingComplete: true,
                commissionRate: true,
                cancellationPolicy: true,
              },
            },
          },
        },
      },
    });
    if (!offer) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Offer not found' },
      };
    }
    if (offer.status !== RequestOfferStatus.SENT) {
      return {
        success: false,
        error: {
          code: 'CONFLICT',
          message: `Offer is ${offer.status.toLowerCase()}`,
        },
      };
    }
    if (offer.expiresAt.getTime() <= Date.now()) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'This offer has expired' },
      };
    }
    if (!offer.scheduledDate || !offer.scheduledStartTime) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Offer is missing a date' },
      };
    }

    const winery = offer.request.winery;
    if (!winery || winery.status !== WineryStatus.VERIFIED) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery is not available' },
      };
    }
    if (!winery.stripeAccountId || !winery.stripeOnboardingComplete) {
      return {
        success: false,
        error: {
          code: 'STRIPE_NOT_READY',
          message: 'Winery payment setup not complete',
        },
      };
    }
    const stripeAccountId = winery.stripeAccountId;

    // Money (all-in price; commission of the winery's tier, NO service fee).
    const totalPrice = offer.totalPrice;
    const commissionRate = getEffectiveCommissionRate(
      winery,
      getPlatformCommissionRate()
    );
    const platformFee = computeCommissionCents(totalPrice, commissionRate);
    const wineryPayout = totalPrice - platformFee;

    // Reuse a single booking per offer — never mint a second (double-charge).
    let bookingId = offer.bookingId;
    if (bookingId) {
      const existing = await db.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });
      if (existing?.status === BookingStatus.CONFIRMED) {
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'This offer is already paid' },
        };
      }
      if (!existing || existing.status !== BookingStatus.PENDING_PAYMENT) {
        bookingId = null;
      }
    }

    const expiresAt = addMinutes(new Date(), STRIPE_SESSION_DURATION_MINUTES);

    if (!bookingId) {
      const holder = await getOrCreateSurMesureExperience(winery.id);
      const created = await db.booking.create({
        data: {
          reference: `ENC-${createId().slice(0, 8).toUpperCase()}`,
          visitorEmail: offer.request.clientEmail,
          visitorName: offer.request.clientName,
          visitorPhone: offer.request.clientPhone ?? '',
          experienceId: holder.id,
          wineryId: winery.id,
          date: offer.scheduledDate,
          timeSlot: offer.scheduledStartTime,
          guestCount: offer.request.guestCount,
          totalPrice,
          platformFee,
          serviceFeeCents: 0,
          cancellationPolicy: winery.cancellationPolicy,
          wineryPayout,
          status: BookingStatus.PENDING_PAYMENT,
          locale: offer.request.locale,
          expiresAt,
        },
        select: { id: true, reference: true },
      });
      // Link the booking to the offer atomically; on a lost race reuse the
      // winner's booking and drop ours (no orphan double booking).
      const linked = await db.requestOffer.updateMany({
        where: { id: offer.id, bookingId: null },
        data: { bookingId: created.id },
      });
      if (linked.count === 0) {
        await db.booking.delete({ where: { id: created.id } });
        const winner = await db.requestOffer.findUnique({
          where: { id: offer.id },
          select: { bookingId: true },
        });
        if (!winner?.bookingId) {
          return {
            success: false,
            error: { code: 'CONFLICT', message: 'Please retry' },
          };
        }
        bookingId = winner.bookingId;
      } else {
        bookingId = created.id;
      }
    }

    const baseUrl = getBaseUrl();
    const routing = routingPath(offer.request.locale);
    const bookingReference =
      (
        await db.booking.findUnique({
          where: { id: bookingId },
          select: { reference: true },
        })
      )?.reference ?? '';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['twint', 'card', 'link'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: {
              name: 'Offre sur-mesure',
              description: winery.name,
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        ...(platformFee > 0 ? { application_fee_amount: platformFee } : {}),
        transfer_data: { destination: stripeAccountId },
      },
      customer_email: offer.request.clientEmail,
      success_url: `${baseUrl}/booking/${bookingId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${routing}/sur-mesure/offre/${parsed.data.token}?status=cancelled`,
      metadata: {
        kind: 'request_offer',
        bookingId,
        bookingReference,
        requestOfferId: offer.id,
      },
    };

    const isPaymentMethodRejection = (err: unknown): boolean => {
      if (typeof err !== 'object' || err === null) return false;
      const { type, param } = err as { type?: unknown; param?: unknown };
      return (
        type === 'StripeInvalidRequestError' &&
        typeof param === 'string' &&
        param.startsWith('payment_method_types')
      );
    };

    let session;
    try {
      session = await getStripe().checkout.sessions.create(sessionParams);
    } catch (stripeError) {
      if (!isPaymentMethodRejection(stripeError)) throw stripeError;
      session = await getStripe().checkout.sessions.create({
        ...sessionParams,
        payment_method_types: ['card'],
      });
    }

    if (!session.url) {
      return {
        success: false,
        error: {
          code: 'STRIPE_ERROR',
          message: 'Failed to create checkout session',
        },
      };
    }

    await db.$transaction([
      // Refresh expiresAt too: a REUSED pending booking may carry a stale
      // window from an abandoned attempt, which the expire-pending cron
      // would delete mid-payment.
      db.booking.update({
        where: { id: bookingId },
        data: { stripeCheckoutSessionId: session.id, expiresAt },
      }),
      db.requestOffer.update({
        where: { id: offer.id },
        data: { stripeCheckoutSessionId: session.id },
      }),
    ]);

    return { success: true, data: { checkoutUrl: session.url } };
  } catch (error) {
    logError('createRequestOfferCheckout error', error, {
      action: 'createRequestOfferCheckout',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to start checkout' },
    };
  }
}
