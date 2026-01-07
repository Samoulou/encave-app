import { z } from 'zod';

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
 * Image file validation schema
 */
export const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= 5 * 1024 * 1024, 'Image must be less than 5MB')
  .refine(
    (f) => ['image/jpeg', 'image/png'].includes(f.type),
    'Only JPEG and PNG images are allowed'
  );

export type ImageFile = z.infer<typeof imageFileSchema>;
