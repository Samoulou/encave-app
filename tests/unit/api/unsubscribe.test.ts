import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const checkRateLimit = vi.fn();
vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => '203.0.113.7',
  GEOCODE_RATE_LIMIT: { maxRequests: 30, windowMs: 60_000 },
}));

const applyWineryUnsubscribe = vi.fn();
const applyClientUnsubscribe = vi.fn();
vi.mock('@/server/services/email-preferences.service', () => ({
  applyWineryUnsubscribe: (...args: unknown[]) =>
    applyWineryUnsubscribe(...args),
  applyClientUnsubscribe: (...args: unknown[]) =>
    applyClientUnsubscribe(...args),
  // Real parser: the route's contract is "unknown scope = all".
  parseWineryUnsubscribeType: (value: string | null) =>
    ['daily_digest', 'weekly_summary', 'marketing', 'all'].includes(value ?? '')
      ? value
      : 'all',
}));

const winery = await import('@/app/api/unsubscribe/[token]/route');
const client = await import('@/app/api/unsubscribe/client/[token]/route');

function req(path: string, method: 'GET' | 'POST' = 'GET'): NextRequest {
  return new NextRequest(new URL(`https://encave.ch${path}`), {
    method,
    ...(method === 'POST'
      ? {
          body: 'List-Unsubscribe=One-Click',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }
      : {}),
  });
}
const params = (token: string) => ({ params: Promise.resolve({ token }) });

describe('unsubscribe routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ success: true });
  });

  describe('winery — /api/unsubscribe/[token]', () => {
    it('GET (footer link): applies the scope and redirects to the confirmation page', async () => {
      applyWineryUnsubscribe.mockResolvedValue('success');

      const res = await winery.GET(
        req('/api/unsubscribe/tok-1?type=daily_digest'),
        params('tok-1')
      );

      expect(applyWineryUnsubscribe).toHaveBeenCalledWith(
        'tok-1',
        'daily_digest'
      );
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'https://encave.ch/unsubscribe?status=success&type=daily_digest'
      );
    });

    it('GET: an unknown ?type is never reflected — it becomes "all"', async () => {
      applyWineryUnsubscribe.mockResolvedValue('success');

      const res = await winery.GET(
        req('/api/unsubscribe/tok-1?type=%3Cscript%3E'),
        params('tok-1')
      );

      expect(applyWineryUnsubscribe).toHaveBeenCalledWith('tok-1', 'all');
      expect(res.headers.get('location')).toBe(
        'https://encave.ch/unsubscribe?status=success&type=all'
      );
    });

    it.each(['invalid', 'expired'] as const)(
      'GET: %s token redirects to its status page',
      async (outcome) => {
        applyWineryUnsubscribe.mockResolvedValue(outcome);

        const res = await winery.GET(
          req('/api/unsubscribe/tok-1'),
          params('tok-1')
        );

        expect(res.headers.get('location')).toBe(
          `https://encave.ch/unsubscribe?status=${outcome}`
        );
      }
    );

    it('POST (RFC 8058 one-click): 200 without redirect', async () => {
      applyWineryUnsubscribe.mockResolvedValue('success');

      const res = await winery.POST(
        req('/api/unsubscribe/tok-1?type=weekly_summary', 'POST'),
        params('tok-1')
      );

      expect(applyWineryUnsubscribe).toHaveBeenCalledWith(
        'tok-1',
        'weekly_summary'
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
      expect(await res.json()).toEqual({
        unsubscribed: true,
        type: 'weekly_summary',
      });
    });

    it('POST: unknown token 404, expired token 410', async () => {
      applyWineryUnsubscribe.mockResolvedValueOnce('invalid');
      expect(
        (await winery.POST(req('/api/unsubscribe/x', 'POST'), params('x')))
          .status
      ).toBe(404);

      applyWineryUnsubscribe.mockResolvedValueOnce('expired');
      expect(
        (await winery.POST(req('/api/unsubscribe/x', 'POST'), params('x')))
          .status
      ).toBe(410);
    });

    it('is rate limited per IP (public endpoint)', async () => {
      checkRateLimit.mockResolvedValue({ success: false });

      const get = await winery.GET(req('/api/unsubscribe/t'), params('t'));
      const post = await winery.POST(
        req('/api/unsubscribe/t', 'POST'),
        params('t')
      );

      expect(get.status).toBe(429);
      expect(post.status).toBe(429);
      expect(applyWineryUnsubscribe).not.toHaveBeenCalled();
      expect(checkRateLimit).toHaveBeenCalledWith(
        'unsubscribe:203.0.113.7',
        expect.anything()
      );
    });

    it('a failure never leaks: GET redirects to the error page, POST is 500', async () => {
      applyWineryUnsubscribe.mockRejectedValue(new Error('db down'));

      const get = await winery.GET(req('/api/unsubscribe/t'), params('t'));
      expect(get.headers.get('location')).toBe(
        'https://encave.ch/unsubscribe?status=error'
      );
      const post = await winery.POST(
        req('/api/unsubscribe/t', 'POST'),
        params('t')
      );
      expect(post.status).toBe(500);
    });
  });

  describe('client — /api/unsubscribe/client/[token]', () => {
    it('GET: opts the client out and redirects', async () => {
      applyClientUnsubscribe.mockResolvedValue({
        ok: true,
        preferenceId: 'cp-1',
      });

      const res = await client.GET(
        req('/api/unsubscribe/client/tok-c'),
        params('tok-c')
      );

      expect(applyClientUnsubscribe).toHaveBeenCalledWith('tok-c');
      expect(res.headers.get('location')).toBe(
        'https://encave.ch/unsubscribe?status=success&type=marketing'
      );
    });

    it('GET: unknown token → invalid page', async () => {
      applyClientUnsubscribe.mockResolvedValue({ ok: false });

      const res = await client.GET(
        req('/api/unsubscribe/client/nope'),
        params('nope')
      );

      expect(res.headers.get('location')).toBe(
        'https://encave.ch/unsubscribe?status=invalid'
      );
    });

    it('POST (one-click): 200, or 404 on an unknown token', async () => {
      applyClientUnsubscribe.mockResolvedValueOnce({
        ok: true,
        preferenceId: 'cp-1',
      });
      const ok = await client.POST(
        req('/api/unsubscribe/client/tok-c', 'POST'),
        params('tok-c')
      );
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ unsubscribed: true });

      applyClientUnsubscribe.mockResolvedValueOnce({ ok: false });
      const missing = await client.POST(
        req('/api/unsubscribe/client/nope', 'POST'),
        params('nope')
      );
      expect(missing.status).toBe(404);
    });

    it('is rate limited per IP', async () => {
      checkRateLimit.mockResolvedValue({ success: false });

      const res = await client.POST(
        req('/api/unsubscribe/client/t', 'POST'),
        params('t')
      );

      expect(res.status).toBe(429);
      expect(applyClientUnsubscribe).not.toHaveBeenCalled();
    });
  });
});
