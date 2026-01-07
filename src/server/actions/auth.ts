'use server';

import { signIn, signOut } from '@/server/auth';
import { db } from '@/server/db';
import { hashPassword } from '@/server/password';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import type { ActionResult } from '@/types/actions';
import { AuthError } from 'next-auth';

export async function loginAction(
  email: string,
  password: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

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
