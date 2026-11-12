/**
 * rateLimitPublicRead — the per-IP budget of the unauthenticated read
 * actions (pre-launch audit: checkAvailability, getTimeSlotsForDate,
 * getExperienceForBooking, getBookingByToken, getCancellationInfo).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { headerState } = vi.hoisted(() => ({
  headerState: { current: new Headers() },
}));

vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

import {
  PUBLIC_READ_RATE_LIMIT,
  rateLimitPublicRead,
} from '@/server/services/rate-limit.service';

let ipCounter = 0;
/** A fresh client address per test — the in-memory store is module-wide. */
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

function setIp(ip: string): void {
  headerState.current = new Headers({ 'x-forwarded-for': ip });
}

describe('rateLimitPublicRead', () => {
  const originalE2E = process.env.E2E_TEST;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    delete process.env.E2E_TEST;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    if (originalE2E === undefined) delete process.env.E2E_TEST;
    else process.env.E2E_TEST = originalE2E;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it('defaults to a generous 60 requests per minute', () => {
    expect(PUBLIC_READ_RATE_LIMIT).toEqual({
      maxRequests: 60,
      windowMs: 60_000,
    });
  });

  it('returns null while the caller is within the budget', async () => {
    setIp(freshIp());
    const config = { maxRequests: 3, windowMs: 60_000 };

    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
  });

  it('returns a ready RATE_LIMITED ActionResult once the budget is spent', async () => {
    setIp(freshIp());
    const config = { maxRequests: 2, windowMs: 60_000 };
    await rateLimitPublicRead('slots', config);
    await rateLimitPublicRead('slots', config);

    const limited = await rateLimitPublicRead('slots', config);

    expect(limited).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: expect.any(String),
      },
    });
  });

  it('keeps one budget per IP', async () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    setIp(freshIp());
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).not.toBeNull();

    setIp(freshIp());
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
  });

  it('keeps one budget per action key (a busy calendar never starves the ticket page)', async () => {
    setIp(freshIp());
    const config = { maxRequests: 1, windowMs: 60_000 };
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).not.toBeNull();

    expect(await rateLimitPublicRead('booking-token', config)).toBeNull();
  });

  it('uses the first x-forwarded-for hop, then x-real-ip', async () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    const ip = freshIp();
    headerState.current = new Headers({
      'x-forwarded-for': `${ip}, 10.0.0.1`,
    });
    expect(await rateLimitPublicRead('slots', config)).toBeNull();

    // Same client seen through x-real-ip only → same bucket, now spent.
    headerState.current = new Headers({ 'x-real-ip': ip });
    expect(await rateLimitPublicRead('slots', config)).not.toBeNull();
  });

  it('is bypassed under the E2E switch (shared Playwright IP)', async () => {
    process.env.E2E_TEST = 'true';
    setIp(freshIp());
    const config = { maxRequests: 1, windowMs: 60_000 };

    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).toBeNull();
  });

  it('is NOT bypassed by the E2E switch on the production deployment', async () => {
    process.env.E2E_TEST = 'true';
    process.env.VERCEL_ENV = 'production';
    setIp(freshIp());
    const config = { maxRequests: 1, windowMs: 60_000 };

    expect(await rateLimitPublicRead('slots', config)).toBeNull();
    expect(await rateLimitPublicRead('slots', config)).not.toBeNull();
  });
});
