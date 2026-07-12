import type { Prisma } from '@prisma/client';
import { GiftCardStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';
import { logError, logInfo } from '@/lib/logger';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale as RoutingLocale } from '@/i18n/routing';
import {
  GIFT_CARD_VARIANTS,
  type GiftCardVariant,
} from '@/lib/constants/gift-card';
import { generateGiftCardPDF } from '@/server/services/giftCard-pdf.service';
import { sendGiftCardDeliveryEmail } from '@/server/services/email.service';
import { formatGiftCodeForDisplay } from '@/server/services/giftCard.service';
import type { ScheduledJobHandlerResult } from '@/server/services/scheduled-jobs.service';

/**
 * GIFT_CARD_DELIVERY job handler (P-09 / L-083, email #7): sends the gift
 * to the recipient on the chosen date. Dedup by `deliveredAt` on top of
 * the runner's atomic claim; a send failure throws → retried.
 */
export async function processGiftCardDeliveryJob(
  payload: Prisma.JsonValue
): Promise<ScheduledJobHandlerResult> {
  const isObjectPayload =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload);
  const giftCardId =
    isObjectPayload && typeof payload.giftCardId === 'string'
      ? payload.giftCardId
      : null;
  if (!giftCardId) {
    return { ok: false, skipReason: 'invalid_payload' };
  }
  const payloadVariant =
    isObjectPayload && typeof payload.variant === 'string'
      ? payload.variant
      : null;

  const giftCard = await db.giftCard.findUnique({
    where: { id: giftCardId },
    select: {
      id: true,
      code: true,
      status: true,
      initialAmount: true,
      deliveredAt: true,
      recipientEmail: true,
      recipientName: true,
      purchaserName: true,
      message: true,
      expiresAt: true,
      locale: true,
      experience: { select: { title: true } },
    },
  });
  if (!giftCard) {
    return { ok: false, skipReason: 'gift_card_not_found' };
  }
  if (giftCard.deliveredAt !== null) {
    // Belt-and-braces dedup on top of the atomic claim.
    return { ok: true, note: 'already_delivered' };
  }
  if (giftCard.status !== GiftCardStatus.ACTIVE) {
    // Disabled (fraud) or expired before delivery — never send.
    return { ok: false, skipReason: `status_${giftCard.status.toLowerCase()}` };
  }
  if (!giftCard.recipientEmail) {
    return { ok: false, skipReason: 'no_recipient' };
  }

  const routingLocale = giftCard.locale.toLowerCase() as RoutingLocale;
  // Theme chosen at purchase, carried on the job payload; NEUTRE if absent.
  const variant: GiftCardVariant = GIFT_CARD_VARIANTS.includes(
    payloadVariant as GiftCardVariant
  )
    ? (payloadVariant as GiftCardVariant)
    : 'NEUTRE';
  const pdf = await generateGiftCardPDF({
    code: giftCard.code,
    amountCents: giftCard.initialAmount,
    variant,
    locale: giftCard.locale,
    purchaserName: giftCard.purchaserName ?? '',
    recipientName: giftCard.recipientName,
    message: giftCard.message,
    expiresAt: giftCard.expiresAt,
    experienceTitle: giftCard.experience?.title ?? null,
  });

  const result = await sendGiftCardDeliveryEmail(
    giftCard.recipientEmail,
    {
      giftCardId: giftCard.id,
      recipientName: giftCard.recipientName ?? giftCard.recipientEmail,
      purchaserName: giftCard.purchaserName ?? 'EnCave',
      amount: formatCHF(giftCard.initialAmount),
      message: giftCard.message,
      code: formatGiftCodeForDisplay(giftCard.code),
      giftUrl: `${getBaseUrl()}/${routingLocale}/bon/${giftCard.code}`,
      expiryDate: formatDate(giftCard.expiresAt, routingLocale),
      pdf,
    },
    giftCard.locale
  );
  if (!result.ok) {
    throw new Error('gift_card_delivery_send_failed');
  }

  // The email is OUT — post-send bookkeeping must never throw, or the
  // runner would retry and resend.
  try {
    await db.giftCard.update({
      where: { id: giftCard.id },
      data: { deliveredAt: new Date() },
    });
  } catch (error) {
    logError('gift card delivery post-send bookkeeping failed', error, {
      action: 'processGiftCardDeliveryJob',
      giftCardId: giftCard.id,
    });
  }
  logInfo('gift_card.delivered', {
    action: 'processGiftCardDeliveryJob',
    giftCardId: giftCard.id,
  });
  return { ok: true };
}
