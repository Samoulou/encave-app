'use server';

import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { getTranslations } from 'next-intl/server';
import { ExperienceStatus, WineryStatus } from '@prisma/client';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';
import type { ActionResult } from '@/types/actions';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  checkRateLimit,
  getClientIp,
  BOOKING_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';
import {
  createGiftCardSchema,
  type CreateGiftCardInput,
} from '@/lib/validators/giftCard';
import { GIFT_CARD_PURCHASE_FEE_CENTS } from '@/lib/constants/gift-card';

export interface GiftCheckoutResult {
  checkoutUrl: string;
}

/**
 * Start a gift-card purchase (P-09 / L-081). Public (guest purchase), so
 * rate-limited per IP and safeParsed. The card value is charged plus the
 * 2.50 fee as a SEPARATE line; NO winery transfer/commission at purchase
 * (platform funds — BUSINESS §4). The GiftCard row is created by the
 * webhook once the payment succeeds, from the session metadata.
 */
export async function createGiftCardCheckoutAction(
  input: CreateGiftCardInput
): Promise<ActionResult<GiftCheckoutResult>> {
  try {
    // Money feature — behind the kill-switch, OFF by default.
    if (!(await isFlagEnabled('GIFT_CARDS'))) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gift cards are not available' },
      };
    }

    const ip = getClientIp(await headers());
    const rateLimit = await checkRateLimit(`gift:${ip}`, BOOKING_RATE_LIMIT);
    if (!rateLimit.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
        },
      };
    }

    const validated = createGiftCardSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input data' },
      };
    }
    const data = validated.data;
    const locale = data.locale ?? 'fr';

    // Delivery date must not be in the past beyond today (the configurator
    // offers today→+1y; a job with a past runAt drains on the next pass).
    const deliverAt = new Date(data.deliverAt);
    if (Number.isNaN(deliverAt.getTime())) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid delivery date' },
      };
    }

    // Resolve the card value + nominatif target.
    let amountCents: number;
    let experienceId: string | undefined;
    let experienceTitle: string | undefined;
    if (data.nature === 'EXPERIENCE') {
      const experience = await db.experience.findUnique({
        where: { id: data.experienceId },
        select: {
          id: true,
          title: true,
          price: true,
          status: true,
          winery: { select: { status: true } },
        },
      });
      if (
        !experience ||
        experience.status !== ExperienceStatus.PUBLISHED ||
        experience.winery.status !== WineryStatus.VERIFIED
      ) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Experience is not available for a gift',
          },
        };
      }
      amountCents = experience.price;
      experienceId = experience.id;
      experienceTitle = experience.title;
    } else {
      amountCents = data.amountCents;
    }

    const t = await getTranslations({ locale, namespace: 'giftCards' });
    const baseUrl = getBaseUrl();

    const metadata: Record<string, string> = {
      kind: 'gift_card',
      nature: data.nature,
      amountCents: String(amountCents),
      recipientEmail: data.recipientEmail,
      purchaserName: data.purchaserName,
      deliverAt: deliverAt.toISOString(),
      variant: data.variant,
      locale,
    };
    if (data.recipientName) metadata.recipientName = data.recipientName;
    if (data.message) metadata.message = data.message;
    if (experienceId) metadata.experienceId = experienceId;
    if (experienceTitle)
      metadata.experienceTitle = experienceTitle.slice(0, 200);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['twint', 'card', 'link'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: {
              name: t('checkoutLineItem'),
              description: experienceTitle ?? undefined,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
        // Purchase fee — separate visible line, platform revenue (no
        // winery transfer/commission at purchase).
        {
          price_data: {
            currency: 'chf',
            product_data: { name: t('checkoutFee') },
            unit_amount: GIFT_CARD_PURCHASE_FEE_CENTS,
          },
          quantity: 1,
        },
      ],
      customer_email: data.purchaserEmail,
      success_url: `${baseUrl}/${locale}/cadeaux?status=success`,
      cancel_url: `${baseUrl}/${locale}/cadeaux?status=cancelled`,
      metadata,
    };

    // TWINT may be disabled on the platform account — same fallback as the
    // booking checkout (D4): retry card-only on a payment-method rejection.
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

    return { success: true, data: { checkoutUrl: session.url } };
  } catch (error) {
    logError('createGiftCardCheckoutAction error', error, {
      action: 'createGiftCardCheckoutAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to start checkout' },
    };
  }
}
