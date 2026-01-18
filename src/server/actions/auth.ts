'use server';

import { headers, cookies } from 'next/headers';
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
import type { Locale, UserRole } from '@prisma/client';

/**
 * Get the user's preferred locale from cookies (set by next-intl)
 */
async function getPreferredLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value?.toUpperCase();

  if (localeCookie === 'FR' || localeCookie === 'DE' || localeCookie === 'EN') {
    return localeCookie;
  }

  return 'FR'; // Default to French
}

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
): Promise<ActionResult<{ success: boolean; role: UserRole }>> {
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

    // Fetch user to get their role before signing in
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { role: true },
    });

    if (!user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      };
    }

    // Import signIn dynamically to avoid "use server" export issue
    const { signIn } = await import('@/server/auth');
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    // Reset rate limit on successful login
    await resetRateLimit(identifier);

    return { success: true, data: { success: true, role: user.role } };
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
    // BACK-002 FIX: Return ActionResult instead of throwing unhandled error
    console.error('Login error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    };
  }
}

export async function registerAction(
  input: RegisterInput
): Promise<ActionResult<{ userId: string }>> {
  try {
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
    const preferredLocale = await getPreferredLocale();

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        preferredLocale,
      },
    });

    return { success: true, data: { userId: user.id } };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    };
  }
}

export async function logoutAction(): Promise<void> {
  // Import signOut dynamically to avoid "use server" export issue
  const { signOut } = await import('@/server/auth');
  await signOut({ redirect: false });
}
