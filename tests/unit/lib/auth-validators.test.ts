import { describe, it, expect } from 'vitest';
import {
  passwordSchema,
  loginSchema,
  registerSchema,
} from '@/lib/validators/auth';

describe('passwordSchema', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('short1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    const result = passwordSchema.safeParse('longpassword');
    expect(result.success).toBe(false);
  });

  it('accepts valid passwords', () => {
    const result = passwordSchema.safeParse('password123');
    expect(result.success).toBe(true);
  });

  it('accepts passwords with special characters', () => {
    const result = passwordSchema.safeParse('P@ssw0rd!');
    expect(result.success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('rejects short names', () => {
    const result = registerSchema.safeParse({
      name: 'A',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      isWinemaker: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password456',
      isWinemaker: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'weak',
      confirmPassword: 'weak',
      isWinemaker: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      isWinemaker: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration with isWinemaker true', () => {
    const result = registerSchema.safeParse({
      name: 'Winemaker User',
      email: 'winemaker@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      isWinemaker: true,
    });
    expect(result.success).toBe(true);
  });
});
