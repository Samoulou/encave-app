import { z } from 'zod';
import { timeSlotSchema } from '@/lib/validators/booking';
import { isDateKey } from '@/lib/utils/date-key';
import {
  WINE_NAME_MAX_LENGTH,
  WINE_GRAPE_MAX_LENGTH,
  WINE_PRICE_MAX_CENTS,
  WINE_VINTAGE_MIN,
  TASTING_SHEET_MAX_WINES,
  WINE_ORDER_MAX_ITEMS,
  WINE_ORDER_MAX_QUANTITY,
} from '@/lib/constants/wine';

/**
 * Wine catalogue + tasting-sheet inputs (P-07 / L-060, L-061).
 * Owner-side actions — ownership/tenant checks live in the actions.
 */

const wineFieldsSchema = z.object({
  name: z.string().trim().min(1).max(WINE_NAME_MAX_LENGTH),
  grapeVariety: z.string().trim().min(1).max(WINE_GRAPE_MAX_LENGTH),
  // Next year's vintage is legitimate right after the harvest announcement.
  vintage: z
    .number()
    .int()
    .min(WINE_VINTAGE_MIN)
    .max(new Date().getFullYear() + 1)
    .nullable(),
  /** Cents (CHF), like every price in the schema. */
  price: z.number().int().min(0).max(WINE_PRICE_MAX_CENTS),
  available: z.boolean(),
});

export const createWineSchema = wineFieldsSchema;

export const updateWineSchema = wineFieldsSchema.partial().extend({
  wineId: z.string().cuid(),
});

export const deleteWineSchema = z.object({
  wineId: z.string().cuid(),
});

// isDateKey rejects impossible dates ("2026-02-31") that a bare regex
// lets through — same guard as the occurrence validators (P-05).
const dateKeySchema = z
  .string()
  .refine(isDateKey, 'Expected a valid YYYY-MM-DD date');

/**
 * Tasting sheet, filled per SESSION (D1): the checked wines fan out to
 * every active booking of (experienceId, date, timeSlot). An empty
 * wineIds list clears the sheet and cancels the pending recap jobs.
 */
export const saveTastingSheetSchema = z.object({
  experienceId: z.string().cuid(),
  date: dateKeySchema,
  timeSlot: timeSlotSchema,
  wineIds: z.array(z.string().cuid()).max(TASTING_SHEET_MAX_WINES),
});

/**
 * Public wine-order request from the J+2 recap email (D3). The token is
 * the recap (or booking access) token — plaintext, hashed server-side.
 */
export const submitWineOrderRequestSchema = z.object({
  bookingId: z.string().cuid(),
  token: z.string().min(32).max(128),
  items: z
    .array(
      z.object({
        wineId: z.string().cuid(),
        quantity: z.number().int().min(1).max(WINE_ORDER_MAX_QUANTITY),
      })
    )
    .min(1)
    .max(WINE_ORDER_MAX_ITEMS),
});

/**
 * UI form shape (strings from inputs) — converted to the action input by
 * wineFormToActionInput. Kept here so components never inline z.object().
 */
export const wineFormSchema = z.object({
  name: z.string().trim().min(1).max(WINE_NAME_MAX_LENGTH),
  grapeVariety: z.string().trim().min(1).max(WINE_GRAPE_MAX_LENGTH),
  vintage: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .refine(
      (value) => {
        const year = Number(value);
        return year >= WINE_VINTAGE_MIN && year <= new Date().getFullYear() + 1;
      },
      { message: 'Invalid vintage' }
    )
    .or(z.literal('')),
  /** CHF with optional decimals, "24.50" or "24,50". */
  priceChf: z
    .string()
    .trim()
    .regex(/^\d{1,4}([.,]\d{1,2})?$/),
});

export type WineFormInput = z.infer<typeof wineFormSchema>;

export function wineFormToActionInput(form: WineFormInput): CreateWineInput {
  return {
    name: form.name.trim(),
    grapeVariety: form.grapeVariety.trim(),
    vintage: form.vintage === '' ? null : Number(form.vintage),
    price: Math.round(Number(form.priceChf.replace(',', '.')) * 100),
    available: true,
  };
}

export type CreateWineInput = z.infer<typeof createWineSchema>;
export type UpdateWineInput = z.infer<typeof updateWineSchema>;
export type SaveTastingSheetInput = z.infer<typeof saveTastingSheetSchema>;
export type SubmitWineOrderRequestInput = z.infer<
  typeof submitWineOrderRequestSchema
>;
