import crypto from 'crypto';
import type Stripe from 'stripe';
import { addYears } from 'date-fns';
import {
  GiftCardStatus,
  GiftCardTransactionType,
  Locale,
} from '@prisma/client';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale as RoutingLocale } from '@/i18n/routing';
import {
  GIFT_CARD_VALIDITY_YEARS,
  GIFT_CARD_DELIVERY_JOB_TYPE,
  GIFT_CODE_ALPHABET,
  GIFT_CODE_LENGTH,
  GIFT_CODE_GROUP_SIZE,
  GIFT_CARD_VARIANTS,
  type GiftCardVariant,
} from '@/lib/constants/gift-card';
import { generateGiftCardPDF } from '@/server/services/giftCard-pdf.service';
import { sendGiftCardPurchaseEmail } from '@/server/services/email.service';

/**
 * Gift card domain service (P-09). Creation flows through the append-only
 * ledger built in P-02: every card is born with a single PURCHASE
 * transaction in the same DB transaction, so `balance` and the ledger sum
 * can never diverge (redemption lives in PR2).
 */

/** Human-typed code, e.g. "ABCD-EFGH-JKMN" (unambiguous alphabet). */
export function formatGiftCodeForDisplay(code: string): string {
  const groups = code.match(new RegExp(`.{1,${GIFT_CODE_GROUP_SIZE}}`, 'g'));
  return groups ? groups.join('-') : code;
}

function randomGiftCode(): string {
  let code = '';
  for (let i = 0; i < GIFT_CODE_LENGTH; i++) {
    code += GIFT_CODE_ALPHABET[crypto.randomInt(GIFT_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * A collision-free code (unique index is the real guard; this just avoids
 * a create that would throw P2002). 30^12 space → collisions are
 * astronomically rare, but we still bound the retries.
 */
export async function generateUniqueGiftCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomGiftCode();
    const existing = await db.giftCard.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique gift code');
}

/** Metadata carried on the gift Checkout Session (webhook source data). */
export interface GiftCheckoutMetadata {
  kind: 'gift_card';
  nature: 'AMOUNT' | 'EXPERIENCE';
  /** Card value in cents (experience price for the EXPERIENCE nature). */
  amountCents: string;
  recipientEmail: string;
  recipientName?: string;
  purchaserName: string;
  message?: string;
  deliverAt: string;
  variant: GiftCardVariant;
  locale: string;
  experienceId?: string;
  experienceTitle?: string;
}

function parseGiftMetadata(
  metadata: Stripe.Metadata | null
): GiftCheckoutMetadata | null {
  if (!metadata || metadata.kind !== 'gift_card') return null;
  const variant = metadata.variant;
  if (
    typeof variant !== 'string' ||
    !GIFT_CARD_VARIANTS.includes(variant as GiftCardVariant)
  ) {
    throw new Error('gift metadata: invalid variant');
  }
  const nature = metadata.nature;
  if (nature !== 'AMOUNT' && nature !== 'EXPERIENCE') {
    throw new Error('gift metadata: invalid nature');
  }
  return {
    kind: 'gift_card',
    nature,
    amountCents: metadata.amountCents ?? '',
    recipientEmail: metadata.recipientEmail ?? '',
    recipientName: metadata.recipientName || undefined,
    purchaserName: metadata.purchaserName ?? '',
    message: metadata.message || undefined,
    deliverAt: metadata.deliverAt ?? '',
    variant: variant as GiftCardVariant,
    locale: metadata.locale ?? 'fr',
    experienceId: metadata.experienceId || undefined,
    experienceTitle: metadata.experienceTitle || undefined,
  };
}

function toPrismaLocale(locale: string): Locale {
  if (locale === 'de') return Locale.DE;
  if (locale === 'en') return Locale.EN;
  return Locale.FR;
}

/**
 * Create the GiftCard + its PURCHASE ledger entry from a paid gift
 * Checkout Session, send the purchaser email (#6, best-effort — never
 * throws), and schedule the recipient delivery (#7) as a GIFT_CARD_DELIVERY
 * job. Idempotent on the payment intent: a webhook redelivery is a no-op.
 */
export async function createGiftCardFromPayment(
  session: Stripe.Checkout.Session
): Promise<{ created: boolean; giftCardId?: string }> {
  const metadata = parseGiftMetadata(session.metadata);
  if (!metadata) return { created: false };

  // Only mint on a genuinely PAID session (mirror of the booking path). For
  // a delayed-settlement method, `completed` may fire unpaid — the card is
  // created when `async_payment_succeeded` re-fires with payment_status paid.
  if (session.payment_status !== 'paid') {
    logInfo('gift_card.session_not_paid — awaiting settlement', {
      action: 'createGiftCardFromPayment',
      paymentStatus: session.payment_status,
    });
    return { created: false };
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const purchaserEmail =
    session.customer_email ?? session.customer_details?.email ?? null;
  const amountCents = Number.parseInt(metadata.amountCents, 10);
  const deliverAt = new Date(metadata.deliverAt);

  if (
    !paymentIntentId ||
    !purchaserEmail ||
    !metadata.recipientEmail ||
    !Number.isFinite(amountCents) ||
    amountCents <= 0 ||
    Number.isNaN(deliverAt.getTime())
  ) {
    throw new Error('gift metadata: incomplete payment context');
  }

  // Idempotency: a redelivered webhook must not mint a second card.
  const existing = await db.giftCard.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true },
  });
  if (existing) {
    logInfo('gift_card.duplicate_payment_skipped', {
      action: 'createGiftCardFromPayment',
      giftCardId: existing.id,
    });
    return { created: false, giftCardId: existing.id };
  }

  const code = await generateUniqueGiftCode();
  const prismaLocale = toPrismaLocale(metadata.locale);
  const expiresAt = addYears(new Date(), GIFT_CARD_VALIDITY_YEARS);

  // Card + opening ledger movement in ONE transaction (P-02 invariant).
  const giftCard = await db.$transaction(async (tx) => {
    const created = await tx.giftCard.create({
      data: {
        code,
        status: GiftCardStatus.ACTIVE,
        initialAmount: amountCents,
        balance: amountCents,
        purchaserEmail: purchaserEmail.toLowerCase(),
        purchaserName: metadata.purchaserName,
        recipientEmail: metadata.recipientEmail.toLowerCase(),
        recipientName: metadata.recipientName ?? null,
        message: metadata.message ?? null,
        experienceId:
          metadata.nature === 'EXPERIENCE'
            ? (metadata.experienceId ?? null)
            : null,
        deliverAt,
        expiresAt,
        stripePaymentIntentId: paymentIntentId,
        locale: prismaLocale,
      },
    });
    await tx.giftCardTransaction.create({
      data: {
        giftCardId: created.id,
        type: GiftCardTransactionType.PURCHASE,
        amount: amountCents,
        note: 'purchase',
      },
    });
    // Recipient delivery (#7) on the chosen date — a past date is drained
    // on the next cron pass. One job per card (dedup by deliveredAt).
    await tx.scheduledJob.create({
      data: {
        type: GIFT_CARD_DELIVERY_JOB_TYPE,
        runAt: deliverAt,
        // variant carried here (not on the card) so #7 keeps the chosen
        // theme without a schema change.
        payload: { giftCardId: created.id, variant: metadata.variant },
      },
    });
    return created;
  });

  logInfo('gift_card.created', {
    action: 'createGiftCardFromPayment',
    giftCardId: giftCard.id,
    nature: metadata.nature,
  });

  // Purchaser email (#6) — immediate, best-effort. A failure must not roll
  // back the card or replay the webhook (which would re-mint nothing but
  // could double-send): log and move on; the card lives in /compte.
  try {
    const routingLocale = prismaLocale.toLowerCase() as RoutingLocale;
    const pdf = await generateGiftCardPDF({
      code,
      amountCents,
      variant: metadata.variant,
      locale: prismaLocale,
      purchaserName: metadata.purchaserName,
      recipientName: metadata.recipientName ?? null,
      message: metadata.message ?? null,
      expiresAt,
      experienceTitle:
        metadata.nature === 'EXPERIENCE'
          ? (metadata.experienceTitle ?? null)
          : null,
    });
    const result = await sendGiftCardPurchaseEmail(
      purchaserEmail,
      {
        giftCardId: giftCard.id,
        purchaserName: metadata.purchaserName,
        recipientName: metadata.recipientName ?? metadata.recipientEmail,
        amount: formatCHF(amountCents),
        code: formatGiftCodeForDisplay(code),
        deliverDate: formatDate(deliverAt, routingLocale),
        expiryDate: formatDate(expiresAt, routingLocale),
        pdf,
      },
      prismaLocale
    );
    if (!result.ok) {
      logError('gift_card.purchase_email_failed', undefined, {
        action: 'createGiftCardFromPayment',
        giftCardId: giftCard.id,
      });
    }
  } catch (error) {
    logError('gift_card.purchase_email_error', error, {
      action: 'createGiftCardFromPayment',
      giftCardId: giftCard.id,
    });
  }

  return { created: true, giftCardId: giftCard.id };
}
