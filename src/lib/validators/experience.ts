import { z } from 'zod';
import { experienceImageSchema as sharedExperienceImageSchema } from './image';

/**
 * Duration options in minutes for wine experiences
 */
export const DURATION_OPTIONS = [
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
  { value: 240, label: 'Half day' },
] as const;

export const durationValues = DURATION_OPTIONS.map((d) => d.value) as [
  number,
  ...number[],
];

/**
 * Experience type options
 */
export const EXPERIENCE_TYPE_OPTIONS = [
  { value: 'TASTING', label: 'Wine Tasting' },
  { value: 'CELLAR_VISIT', label: 'Cellar Visit' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'VINEYARD_TOUR', label: 'Vineyard Tour' },
  { value: 'FOOD_PAIRING', label: 'Food Pairing' },
  // V3 types (P-02 enum, wired to search in P-05 / L-111)
  { value: 'MEAL', label: 'Meal' },
  { value: 'EVENT', label: 'Event' },
] as const;

export const experienceTypeValues = EXPERIENCE_TYPE_OPTIONS.map(
  (t) => t.value
) as [string, ...string[]];

/**
 * Schema for availability time slot
 */
export const availabilitySlotSchema = z.object({
  days: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])),
  timeSlots: z.array(
    z.object({
      start: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
      end: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
    })
  ),
});

/**
 * Schema for location/address
 */
export const locationSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

/**
 * Schema for creating a new experience
 * Validation rules per AC 6:
 * - Title: required, max 100 chars
 * - Description: required, min 100 chars
 * - Price: > 0
 * - Capacity: minCapacity >= 1, maxCapacity >= minCapacity
 */
export const createExperienceSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(100, 'Title must be less than 100 characters'),
    type: z.enum(
      [
        'TASTING',
        'CELLAR_VISIT',
        'WORKSHOP',
        'VINEYARD_TOUR',
        'FOOD_PAIRING',
        'MEAL',
        'EVENT',
      ],
      {
        message: 'Please select an experience type',
      }
    ),
    description: z
      .string()
      .min(100, 'Description must be at least 100 characters')
      .max(5000, 'Description must be less than 5000 characters'),
    duration: z
      .number()
      .refine(
        (val) =>
          durationValues.includes(val as (typeof durationValues)[number]),
        'Please select a valid duration'
      ),
    price: z
      .number()
      .nonnegative('Price cannot be negative')
      .max(100000, 'Price seems too high'),
    minCapacity: z
      .number()
      .int('Minimum capacity must be a whole number')
      .min(1, 'Minimum capacity must be at least 1'),
    maxCapacity: z
      .number()
      .int('Maximum capacity must be a whole number')
      .min(1, 'Maximum capacity must be at least 1'),
    // V3 (P-08 / L-070): ONLINE (paid at checkout) vs ON_SITE (free /
    // pay-at-the-winery). Optional (not .default) to keep the Zod input and
    // output types symmetric — a .default() diverges them and breaks
    // zodResolver. Undefined ⇒ ONLINE (forms set it explicitly).
    paymentMode: z.enum(['ONLINE', 'ON_SITE']).optional(),
    // V3 (P-11 / L-100): mark the experience as a collective event
    // (bandeau + participating-wineries grid on the fiche). Optional (not
    // .default) for the same zodResolver symmetry reason as paymentMode —
    // undefined ⇒ false (@default(false) preserved on create).
    isCollective: z.boolean().optional(),
    // Location fields (optional)
    location: locationSchema.optional(),
    // Availability slots
    availabilitySlots: z.array(availabilitySlotSchema).optional(),
  })
  .refine((data) => data.maxCapacity >= data.minCapacity, {
    message:
      'Maximum capacity must be greater than or equal to minimum capacity',
    path: ['maxCapacity'],
  })
  // ONLINE offers must have a real price; ON_SITE may be free (price 0).
  .refine((data) => data.paymentMode === 'ON_SITE' || data.price > 0, {
    message: 'Price must be greater than 0',
    path: ['price'],
  });

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;

/**
 * Image file validation schema for experiences
 * @deprecated Use experienceImageSchema from '@/lib/validators/image' instead
 */
export const experienceImageSchema = sharedExperienceImageSchema;

export type ExperienceImageFile = z.infer<typeof experienceImageSchema>;
