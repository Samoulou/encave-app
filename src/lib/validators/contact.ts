import { z } from 'zod';

/**
 * Public contact form (P-12 / L-114). `website` is a honeypot — real users
 * never see it, so a non-empty value flags a bot (handled in the action, not
 * a validation error, to avoid tipping the bot off).
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name')
    .max(100, 'Name is too long'),
  email: z.string().trim().email('Invalid email address'),
  subject: z
    .string()
    .trim()
    .min(2, 'Please enter a subject')
    .max(150, 'Subject is too long'),
  message: z
    .string()
    .trim()
    .min(10, 'Please write a little more')
    .max(2000, 'Message is too long'),
  locale: z.enum(['fr', 'de', 'en']).optional(),
  /** Honeypot — must stay empty. */
  website: z.string().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
