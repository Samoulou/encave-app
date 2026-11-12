/**
 * better-auth rate limiter on its DATABASE storage (RateLimit model),
 * through the real handler — the config is evaluated at import, so this
 * suite runs WITHOUT the E2E switch (its sibling auth-security.test.ts
 * disables limits on purpose).
 *
 * Guards, after the 1.4 → 1.7 upgrade:
 *  - the Prisma RateLimit model still satisfies the limiter (a broken
 *    storage would 500 every /api/auth request);
 *  - /sign-in/email keeps its 5 per 15 min brute-force budget, PER CLIENT IP
 *    (1.7 only trusts single-value IP headers — a missing IP would collapse
 *    every visitor into one shared bucket);
 *  - /get-session is exempt (it is called on every page view).
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/encave_inv_sec \
 *     npx vitest run --no-file-parallelism tests/db/auth-rate-limit.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;
const BASE_URL = 'http://localhost:3000';

if (url) {
  process.env.DATABASE_URL = url;
}
process.env.BETTER_AUTH_URL = BASE_URL;
delete process.env.E2E_TEST;
delete process.env.VERCEL_ENV;

vi.mock('@/server/services/email.service', () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendEmailVerificationEmail: vi.fn(async () => {}),
  sendEmailChangedNoticeEmail: vi.fn(async () => {}),
}));

type BetterAuthModule = typeof import('@/server/better-auth');

describe.skipIf(!url)('auth rate limiting (database storage)', () => {
  let db: PrismaClient;
  let auth: BetterAuthModule['auth'];
  // Documentation range (RFC 5737), unique per run.
  const octet = 1 + (Date.now() % 250);
  const ipA = `203.0.113.${octet}`;
  const ipB = `198.51.100.${octet}`;

  function call(
    method: 'GET' | 'POST',
    path: string,
    ip: string,
    body?: unknown
  ) {
    const headers = new Headers({ origin: BASE_URL, 'x-forwarded-for': ip });
    if (body !== undefined) headers.set('content-type', 'application/json');
    return auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    );
  }

  const badLogin = (ip: string) =>
    call('POST', '/sign-in/email', ip, {
      email: 'nobody-rate-limit@test.encave.ch',
      password: 'wrong-password-123',
    });

  beforeAll(async () => {
    ({ auth } = await import('@/server/better-auth'));
    db = new PrismaClient({ datasourceUrl: url });
  });

  afterAll(async () => {
    if (!db) return;
    await db.rateLimit.deleteMany({
      where: { OR: [{ key: { contains: ipA } }, { key: { contains: ipB } }] },
    });
    await db.$disconnect();
  });

  it('is enabled outside the E2E switch', () => {
    expect(auth.options.rateLimit?.enabled).toBe(true);
    expect(auth.options.rateLimit?.storage).toBe('database');
  });

  it('allows 5 password attempts per IP, then answers 429 — from the RateLimit table', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await badLogin(ipA)).status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);

    const rows = await db.rateLimit.findMany({
      where: { key: { contains: ipA } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(5);
  });

  it('keeps a separate budget for another client IP', async () => {
    expect((await badLogin(ipB)).status).toBe(401);
  });

  it('never rate-limits /get-session', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 15; i += 1) {
      statuses.push((await call('GET', '/get-session', ipA)).status);
    }

    expect(new Set(statuses)).toEqual(new Set([200]));
  });
});
