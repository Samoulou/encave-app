'use server';

import { headers } from 'next/headers';
import { signIn, signOut } from '@/server/auth';
import { db } from '@/server/db';
import { hashPassword } from '@/server/password';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import type { ActionResult } from '@/types/actions';
import { AuthError } from 'next-auth';
import {
  checkRateLimit,
  resetRateLimit,
  AUTH_RATE_LIMIT,
  REGISTRATION_RATE_LIMIT,
} from '@/server/services/rate-limit.service';

/**
 * Get client identifier for rate limiting (IP-based)
 */
async function getClientIdentifier(prefix: string): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  return `${prefix}:${ip}`;
}

export async function loginAction(
  email: string,
  password: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    // Rate limiting check
    const identifier = await getClientIdentifier(`login:${email.toLowerCase()}`);
    const rateLimitResult = await checkRateLimit(identifier, AUTH_RATE_LIMIT);

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 1000
      );
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many login attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
        },
      };
    }

    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    // Reset rate limit on successful login
    await resetRateLimit(identifier);

    return { success: true, data: { success: true } };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      };
    }
    throw error;
  }
}

export async function registerAction(
  input: RegisterInput
): Promise<ActionResult<{ userId: string }>> {
  // Rate limiting check
  const identifier = await getClientIdentifier('register');
  const rateLimitResult = await checkRateLimit(identifier, REGISTRATION_RATE_LIMIT);

  if (!rateLimitResult.success) {
    const retryAfterSeconds = Math.ceil(
      (rateLimitResult.resetAt - Date.now()) / 1000
    );
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many registration attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      },
    };
  }

  const validated = registerSchema.safeParse(input);

  if (!validated.success) {
    const firstError = validated.error.issues[0];
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError?.message ?? 'Invalid input',
      },
    };
  }

  const { name, email, password } = validated.data;

  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'An account with this email already exists',
      },
    };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  return { success: true, data: { userId: user.id } };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
}
