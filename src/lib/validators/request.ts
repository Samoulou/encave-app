import { z } from 'zod';
import {
  REQUEST_DESCRIPTION_MIN_LENGTH,
  REQUEST_DESCRIPTION_MAX_LENGTH,
  REQUEST_OFFER_MESSAGE_MIN_LENGTH,
  REQUEST_OFFER_MESSAGE_MAX_LENGTH,
  REQUEST_NAME_MAX_LENGTH,
  REQUEST_GUEST_MIN,
  REQUEST_GUEST_MAX,
  REQUEST_BUDGET_MIN_CENTS,
  REQUEST_BUDGET_MAX_CENTS,
  REQUEST_OFFER_MIN_PRICE_CENTS,
  REQUEST_OFFER_MAX_PRICE_CENTS,
  REQUEST_OFFER_MIN_VALIDITY_DAYS,
  REQUEST_OFFER_MAX_VALIDITY_DAYS,
} from '@/lib/constants/request';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Public sur-mesure request (P-10 / L-090). A winery is MANDATORY at launch
 * (decision Sam 2026-07-13 — "laissez EnCave proposer" deferred). The value
 * on `budgetCents` is indicative only; the price is set later on the offer.
 */
export const createRequestSchema = z.object({
  wineryId: z.string().cuid(),
  clientName: z.string().trim().min(1).max(REQUEST_NAME_MAX_LENGTH),
  clientEmail: z.string().trim().email(),
  clientPhone: z
    .string()
    .trim()
    .max(REQUEST_NAME_MAX_LENGTH)
    .optional()
    .or(z.literal('')),
  /** Preferred date (yyyy-mm-dd), indicative — the offer confirms the slot. */
  desiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  guestCount: z.number().int().min(REQUEST_GUEST_MIN).max(REQUEST_GUEST_MAX),
  budgetCents: z
    .number()
    .int()
    .min(REQUEST_BUDGET_MIN_CENTS)
    .max(REQUEST_BUDGET_MAX_CENTS)
    .optional(),
  description: z
    .string()
    .trim()
    .min(REQUEST_DESCRIPTION_MIN_LENGTH)
    .max(REQUEST_DESCRIPTION_MAX_LENGTH),
  locale: z.enum(['fr', 'de', 'en']).optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

/**
 * Client form shape for /sur-mesure (react-hook-form). The server action
 * re-validates authoritatively with createRequestSchema; this drives the UI
 * (budget is entered in CHF and converted to cents at submit).
 */
export const requestFormSchema = z.object({
  wineryId: z.string().min(1, 'Choisissez une cave'),
  clientName: z.string().trim().min(1).max(REQUEST_NAME_MAX_LENGTH),
  clientEmail: z.string().trim().email(),
  clientPhone: z.string().trim().max(REQUEST_NAME_MAX_LENGTH).optional(),
  desiredDate: z.string().optional(),
  guestCount: z.number().int().min(REQUEST_GUEST_MIN).max(REQUEST_GUEST_MAX),
  budgetChf: z.number().int().min(0).optional(),
  description: z
    .string()
    .trim()
    .min(REQUEST_DESCRIPTION_MIN_LENGTH)
    .max(REQUEST_DESCRIPTION_MAX_LENGTH),
});

export type RequestFormValues = z.infer<typeof requestFormSchema>;

/**
 * Winemaker composes an offer (P-10 / L-091). Price is ALL-IN (no service
 * fee — decision Sam); the tier commission applies at payment. The agreed
 * date/time become Booking.date / Booking.timeSlot when the client pays.
 */
/** yyyy-mm-dd for "today" (UTC) — the floor for a scheduled sur-mesure date. */
function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const composeOfferSchema = z.object({
  requestId: z.string().cuid(),
  message: z
    .string()
    .trim()
    .min(REQUEST_OFFER_MESSAGE_MIN_LENGTH)
    .max(REQUEST_OFFER_MESSAGE_MAX_LENGTH),
  totalPriceCents: z
    .number()
    .int()
    .min(REQUEST_OFFER_MIN_PRICE_CENTS)
    .max(REQUEST_OFFER_MAX_PRICE_CENTS),
  // Must be today or later — a past event date would emit a ticket for a
  // bygone day and never fire the J-1 reminder. Lexicographic compare is
  // safe on yyyy-mm-dd.
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => d >= todayISODate(), {
      message: 'scheduledDate must not be in the past',
    }),
  scheduledStartTime: z.string().regex(TIME_HHMM),
  validityDays: z
    .number()
    .int()
    .min(REQUEST_OFFER_MIN_VALIDITY_DAYS)
    .max(REQUEST_OFFER_MAX_VALIDITY_DAYS),
});

export type ComposeOfferInput = z.infer<typeof composeOfferSchema>;

/** Client form shape for the offer composer (winemaker). */
export const composeOfferFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(REQUEST_OFFER_MESSAGE_MIN_LENGTH)
    .max(REQUEST_OFFER_MESSAGE_MAX_LENGTH),
  totalPriceChf: z
    .number()
    .positive()
    .max(REQUEST_OFFER_MAX_PRICE_CENTS / 100),
  scheduledDate: z.string().min(1),
  scheduledStartTime: z.string().regex(TIME_HHMM, 'Heure invalide (HH:mm)'),
  validityDays: z
    .number()
    .int()
    .min(REQUEST_OFFER_MIN_VALIDITY_DAYS)
    .max(REQUEST_OFFER_MAX_VALIDITY_DAYS),
});

export type ComposeOfferFormValues = z.infer<typeof composeOfferFormSchema>;

/** Pay the offer via the tokenized email link (public). */
export const offerCheckoutSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

/** Request id input (winemaker inbox actions). */
export const requestIdSchema = z.object({
  requestId: z.string().cuid(),
});
