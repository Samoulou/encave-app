import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

describe('Environment validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates DATABASE_URL is required', () => {
    const envSchema = z.object({
      DATABASE_URL: z.string().url(),
    });

    const invalidEnv = {};
    const result = envSchema.safeParse(invalidEnv);

    expect(result.success).toBe(false);
  });

  it('validates DATABASE_URL must be a valid URL', () => {
    const envSchema = z.object({
      DATABASE_URL: z.string().url(),
    });

    const invalidEnv = { DATABASE_URL: 'not-a-url' };
    const result = envSchema.safeParse(invalidEnv);

    expect(result.success).toBe(false);
  });

  it('accepts valid DATABASE_URL', () => {
    const envSchema = z.object({
      DATABASE_URL: z.string().url(),
    });

    const validEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };
    const result = envSchema.safeParse(validEnv);

    expect(result.success).toBe(true);
  });

  it('validates NEXTAUTH_SECRET minimum length', () => {
    const envSchema = z.object({
      NEXTAUTH_SECRET: z.string().min(32),
    });

    const shortSecret = { NEXTAUTH_SECRET: 'tooshort' };
    const result = envSchema.safeParse(shortSecret);

    expect(result.success).toBe(false);
  });

  it('accepts valid NEXTAUTH_SECRET', () => {
    const envSchema = z.object({
      NEXTAUTH_SECRET: z.string().min(32),
    });

    const validSecret = {
      NEXTAUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
    };
    const result = envSchema.safeParse(validSecret);

    expect(result.success).toBe(true);
  });
});
