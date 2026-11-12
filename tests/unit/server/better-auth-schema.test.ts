/**
 * better-auth validates the generated Prisma client against the tables its
 * configuration writes (core + plugins) and REJECTS EVERY /api/auth request
 * with a SchemaMismatchError when a model/field it needs is missing
 * (api/index.mjs onRequest awaits the check). This suite runs that exact
 * check offline — it reads the Prisma data model, never the database — so a
 * better-auth bump that needs a migration fails here, not in production.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/server/services/email.service', () => ({
  sendOtpEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  sendEmailChangedNoticeEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

const { auth } = await import('@/server/better-auth');

describe('better-auth ↔ Prisma schema', () => {
  it('registers a runtime schema check for the Prisma adapter', async () => {
    const ctx = await auth.$context;
    expect(typeof ctx.checkSchema).toBe('function');
  });

  it('finds no missing model, field or type mismatch', async () => {
    const ctx = await auth.$context;
    // Resolves (or returns undefined) when clean; rejects with the list of
    // findings otherwise.
    await expect(Promise.resolve(ctx.checkSchema?.())).resolves.toBeUndefined();
  });
});
