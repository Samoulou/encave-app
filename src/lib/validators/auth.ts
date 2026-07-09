import { z } from 'zod';

// SEC-005: Enhanced password complexity requirements
export const passwordSchema = z
  .string()
  .min(8, 'password.minLength')
  .regex(/\d/, 'password.requireNumber')
  .regex(/[A-Z]/, 'password.requireUppercase')
  .regex(/[a-z]/, 'password.requireLowercase')
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, 'password.requireSpecial');

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string(),
    isWinemaker: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Post-payment one-tap account creation (P-04 / L-053): the email and
 * name come from the booking — the client only chooses a password.
 */
export const oneTapAccountSchema = z.object({
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OneTapAccountInput = z.infer<typeof oneTapAccountSchema>;
