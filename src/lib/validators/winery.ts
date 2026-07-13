import { z } from 'zod';
import { CancellationPolicy } from '@prisma/client';
import { wineryImageSchema } from './image';

/**
 * Swiss phone number validation regex
 * Valid formats: +41 XX XXX XX XX, 0XX XXX XX XX
 * Also accepts formats without spaces
 */
const swissPhoneRegex = /^(\+41|0)\s?[1-9]\d\s?\d{3}\s?\d{2}\s?\d{2}$/;

export const wineryOnboardingSchema = z.object({
  name: z
    .string()
    .min(2, 'Winery name must be at least 2 characters')
    .max(100, 'Winery name must be less than 100 characters'),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  address: z
    .string()
    .min(5, 'Please enter a valid address')
    .max(200, 'Address must be less than 200 characters'),
  commune: z.string().min(1, 'Please select a commune'),
  phone: z
    .string()
    .regex(
      swissPhoneRegex,
      'Please enter a valid Swiss phone number (+41 XX XXX XX XX or 0XX XXX XX XX)'
    ),
});

export type WineryOnboardingInput = z.infer<typeof wineryOnboardingSchema>;

/**
 * Schema for editing winery profile
 */
export const wineryProfileSchema = z.object({
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be less than 2000 characters'),
  address: z
    .string()
    .min(5, 'Please enter a valid address')
    .max(200, 'Address must be less than 200 characters'),
  commune: z.string().min(1, 'Please select a commune'),
  phone: z
    .string()
    .regex(
      swissPhoneRegex,
      'Please enter a valid Swiss phone number (+41 XX XXX XX XX or 0XX XXX XX XX)'
    ),
});

export type WineryProfileInput = z.infer<typeof wineryProfileSchema>;

/**
 * Schema for the winery cancellation-policy selection (P-03 / L-043).
 * The policy drives the refund barème applied at cancellation time
 * (src/lib/business-rules/cancellation-policy.ts).
 */
export const setWineryCancellationPolicySchema = z.object({
  wineryId: z.string().min(1, 'Winery id is required'),
  policy: z.nativeEnum(CancellationPolicy),
});

export type SetWineryCancellationPolicyInput = z.infer<
  typeof setWineryCancellationPolicySchema
>;

/**
 * Schema for the winery no-show fee policy (P-08 / L-070, US-220).
 * feeCents is per guest, 0–50 CHF. The DB also enforces the bound
 * (wineries_no_show_fee_bounds CHECK 0–5000, P-02).
 */
export const setWineryNoShowPolicySchema = z.object({
  wineryId: z.string().min(1, 'Winery id is required'),
  enabled: z.boolean(),
  feeCents: z
    .number()
    .int('Fee must be a whole number of cents')
    .min(0, 'Fee cannot be negative')
    .max(5000, 'Fee cannot exceed 50 CHF'),
});

export type SetWineryNoShowPolicyInput = z.infer<
  typeof setWineryNoShowPolicySchema
>;

/**
 * Image file validation schema
 * @deprecated Use wineryImageSchema from '@/lib/validators/image' instead
 */
export const imageFileSchema = wineryImageSchema;

export type ImageFile = z.infer<typeof imageFileSchema>;
