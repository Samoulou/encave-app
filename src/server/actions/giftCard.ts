'use server';

import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { getTranslations } from 'next-intl/server';
import { ExperienceStatus, GiftCardStatus, WineryStatus } from '@prisma/client';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { auth } from '@/server/auth';
import { requireAdmin } from '@/server/admin-guard';
import { getBaseUrl } from '@/lib/env';
import type { ActionResult } from '@/types/actions';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  checkRateLimit,
  getClientIp,
  BOOKING_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { resendGiftCardEmail } from '@/server/services/giftCard-delivery.service';
import { previewGiftRedemption } from '@/server/services/giftCard-redemption.service';
import { logError, logInfo } from '@/lib/logger';
import {
  createGiftCardSchema,
  giftCardIdSchema,
  previewGiftSchema,
  type CreateGiftCardInput,
} from '@/lib/validators/giftCard';
import { GIFT_CARD_PURCHASE_FEE_CENTS } from '@/lib/constants/gift-card';
import { BOOKING_FEE_CENTS } from '@/lib/constants/pricing';

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
        experience.winery.status !== WineryStatus.VERIFIED ||
        // A 0-priced experience would mint a 0-value gift → amountCents = 0,
        // which the creation webhook rejects deterministically (paid session,
        // no card ever created). Never sell it.
        experience.price <= 0
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

    // E2E (P-16): same fake-session convention as the booking checkout —
    // no Stripe call; the spec POSTs the signed synthetic
    // `checkout.session.completed` (kind: gift_card) itself and the card
    // is minted by the REAL webhook code.
    if (process.env.E2E_TEST === 'true') {
      return {
        success: true,
        data: {
          checkoutUrl: `https://checkout.stripe.com/pay/e2e_gift_${Date.now()}`,
        },
      };
    }

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

/**
 * Disable a gift card for fraud (P-09 / L-086, admin). Flips the status to
 * DISABLED only — the append-only ledger is NEVER touched, and the balance
 * is preserved (a re-enable would restore it). Refused redemption is
 * enforced by the redemption service.
 */
export async function disableGiftCardAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await requireAdmin();
    if (!admin.success) return admin;

    const validated = giftCardIdSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid gift card id' },
      };
    }

    const updated = await db.giftCard.updateMany({
      where: {
        id: validated.data.giftCardId,
        status: { not: GiftCardStatus.DISABLED },
      },
      data: { status: GiftCardStatus.DISABLED },
    });
    if (updated.count === 0) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gift card not found' },
      };
    }

    logInfo('gift_card.disabled', {
      action: 'disableGiftCardAction',
      giftCardId: validated.data.giftCardId,
      adminId: admin.data.adminId,
    });
    return { success: true, data: { id: validated.data.giftCardId } };
  } catch (error) {
    logError('disableGiftCardAction error', error, {
      action: 'disableGiftCardAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to disable gift card' },
    };
  }
}

/**
 * Resend the gift email #7 to the recipient (P-09 / L-085, « renvoyer »).
 * Auth required; only the purchaser or the recipient of the card may
 * trigger it (ownership matched on email).
 */
export async function resendGiftCardAction(
  input: unknown
): Promise<ActionResult<{ sent: true }>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
      };
    }

    const validated = giftCardIdSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid gift card id' },
      };
    }

    const email = session.user.email.toLowerCase();
    const card = await db.giftCard.findFirst({
      where: {
        id: validated.data.giftCardId,
        OR: [{ purchaserEmail: email }, { recipientEmail: email }],
      },
      select: { id: true },
    });
    if (!card) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gift card not found' },
      };
    }

    const ok = await resendGiftCardEmail(card.id);
    if (!ok) {
      return {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to resend the gift' },
      };
    }
    return { success: true, data: { sent: true } };
  } catch (error) {
    logError('resendGiftCardAction error', error, {
      action: 'resendGiftCardAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resend the gift' },
    };
  }
}

/**
 * Preview how much a gift code would cover of a booking (P-09 / L-084, the
 * checkout gift-code field). Read-only, flag-gated, rate-limited per IP
 * (a code-enumeration surface). The due amount is computed SERVER-SIDE
 * from the experience price × guests + booking fee — never trusted from
 * the client. The authoritative redemption re-locks at submit.
 */
export async function previewGiftRedemptionAction(input: unknown): Promise<
  ActionResult<{
    code: string;
    balance: number;
    applicableCents: number;
    remainingDueCents: number;
    dueCents: number;
  }>
> {
  try {
    if (!(await isFlagEnabled('GIFT_CARDS'))) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Gift cards are not available' },
      };
    }
    const ip = getClientIp(await headers());
    const rateLimit = await checkRateLimit(
      `giftpreview:${ip}`,
      BOOKING_RATE_LIMIT
    );
    if (!rateLimit.success) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts.' },
      };
    }

    const validated = previewGiftSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }
    const { code, experienceId, guestCount } = validated.data;

    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      select: { price: true, status: true },
    });
    if (!experience || experience.status !== ExperienceStatus.PUBLISHED) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    const bookingFeeOn = await isFlagEnabled('BOOKING_FEE');
    const dueCents =
      experience.price * guestCount +
      (bookingFeeOn ? BOOKING_FEE_CENTS * guestCount : 0);

    const preview = await previewGiftRedemption({
      code,
      dueCents,
      experienceId,
    });
    if (!preview.ok) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `GIFT_${preview.error}` },
      };
    }

    return {
      success: true,
      data: { ...preview.preview, dueCents },
    };
  } catch (error) {
    logError('previewGiftRedemptionAction error', error, {
      action: 'previewGiftRedemptionAction',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to preview gift code' },
    };
  }
}
