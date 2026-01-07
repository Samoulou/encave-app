import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Authentication
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

function getEnv() {
  // In development, allow missing optional vars
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    );
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = getEnv();
