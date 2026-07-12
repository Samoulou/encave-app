import { z } from 'zod';
import {
  GIFT_CARD_MIN_AMOUNT_CENTS,
  GIFT_CARD_MAX_AMOUNT_CENTS,
  GIFT_CARD_AMOUNT_STEP_CENTS,
  GIFT_CARD_MESSAGE_MAX_LENGTH,
  GIFT_CARD_NAME_MAX_LENGTH,
  GIFT_CARD_VARIANTS,
} from '@/lib/constants/gift-card';

/**
 * Gift card purchase input (P-09 / L-080, L-081). Two natures (decision
 * 2026-07-12):
 *  - AMOUNT: free value 20–500 CHF (multiple of 10), redeemable anywhere;
 *  - EXPERIENCE: nominatif « 1 place sur X », locked to `experienceId`.
 * The value is recomputed authoritatively server-side (experience price
 * for EXPERIENCE); `amountCents` is ignored for that nature.
 */
const baseGiftFields = z.object({
  purchaserName: z.string().trim().min(1).max(GIFT_CARD_NAME_MAX_LENGTH),
  purchaserEmail: z.string().trim().email(),
  recipientName: z
    .string()
    .trim()
    .min(1)
    .max(GIFT_CARD_NAME_MAX_LENGTH)
    .optional(),
  recipientEmail: z.string().trim().email(),
  message: z.string().trim().max(GIFT_CARD_MESSAGE_MAX_LENGTH).optional(),
  /** Recipient delivery date (email #7). Today → sent on the next drain. */
  deliverAt: z.string().datetime(),
  variant: z.enum(GIFT_CARD_VARIANTS),
  locale: z.enum(['fr', 'de', 'en']).optional(),
});

export const createGiftCardSchema = z.discriminatedUnion('nature', [
  baseGiftFields.extend({
    nature: z.literal('AMOUNT'),
    amountCents: z
      .number()
      .int()
      .min(GIFT_CARD_MIN_AMOUNT_CENTS)
      .max(GIFT_CARD_MAX_AMOUNT_CENTS)
      .refine((value) => value % GIFT_CARD_AMOUNT_STEP_CENTS === 0, {
        message: 'Amount must be a multiple of 10 CHF',
      }),
  }),
  baseGiftFields.extend({
    nature: z.literal('EXPERIENCE'),
    experienceId: z.string().cuid(),
  }),
]);

export type CreateGiftCardInput = z.infer<typeof createGiftCardSchema>;

/**
 * Client form shape for the /cadeaux configurator (react-hook-form). The
 * server action re-validates authoritatively with createGiftCardSchema;
 * this only drives the UI (amount is a number of cents from a preset
 * select, delivery is a plain date string converted at submit).
 */
export const giftCardFormSchema = z
  .object({
    nature: z.enum(['AMOUNT', 'EXPERIENCE']),
    amountCents: z
      .number()
      .int()
      .min(GIFT_CARD_MIN_AMOUNT_CENTS)
      .max(GIFT_CARD_MAX_AMOUNT_CENTS),
    experienceId: z.string().optional(),
    variant: z.enum(GIFT_CARD_VARIANTS),
    purchaserName: z.string().trim().min(1).max(GIFT_CARD_NAME_MAX_LENGTH),
    purchaserEmail: z.string().trim().email(),
    recipientName: z
      .string()
      .trim()
      .max(GIFT_CARD_NAME_MAX_LENGTH)
      .optional()
      .or(z.literal('')),
    recipientEmail: z.string().trim().email(),
    message: z
      .string()
      .trim()
      .max(GIFT_CARD_MESSAGE_MAX_LENGTH)
      .optional()
      .or(z.literal('')),
    deliverDate: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.nature === 'EXPERIENCE' && !data.experienceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['experienceId'],
        message: 'Please choose an experience',
      });
    }
  });

export type GiftCardFormValues = z.infer<typeof giftCardFormSchema>;

/** Redemption code lookup (checkout + /bon/[code]) — PR2 uses this too. */
export const giftCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().min(8).max(24));
