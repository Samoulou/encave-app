import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['fr', 'de', 'en'],
    defaultLocale: 'fr',
  },
}));

/**
 * MAINTENANCE_MODE is read once at module load (Edge constant, like
 * COMING_SOON) — each scenario re-imports the middleware with its env.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return (await import('@/middleware')).default;
}

function request(
  path: string,
  init: { method?: string; host?: string } = {}
): NextRequest {
  return new NextRequest(new URL(`https://encave.ch${path}`), {
    method: init.method ?? 'GET',
    headers: { host: init.host ?? 'encave.ch' },
  });
}

const ORIGINAL = {
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
  COMING_SOON: process.env.COMING_SOON,
};

describe('middleware — MAINTENANCE_MODE write freeze', () => {
  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  });

  describe('MAINTENANCE_MODE=true', () => {
    let middleware: Awaited<ReturnType<typeof load>>;
    beforeEach(async () => {
      middleware = await load({
        MAINTENANCE_MODE: 'true',
        COMING_SOON: 'false',
      });
    });

    it.each([
      ['/fr', 'fr'],
      ['/de/experiences/degustation', 'de'],
      ['/en/dashboard/bookings', 'en'],
      // No locale prefix → default locale.
      ['/', 'fr'],
      ['/coming-soon', 'fr'],
    ])(
      'page %s is served the %s maintenance page with 503 + Retry-After',
      async (path, locale) => {
        const res = (await middleware(request(path))) as NextResponse;

        expect(res.status).toBe(503);
        expect(res.headers.get('retry-after')).toBe('600');
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(res.headers.get('x-middleware-rewrite')).toBe(
          `https://encave.ch/${locale}/maintenance`
        );
      }
    );

    it('takes precedence over the auth redirect of protected routes', async () => {
      const res = (await middleware(request('/fr/admin'))) as NextResponse;

      expect(res.status).toBe(503);
      expect(res.headers.get('location')).toBeNull();
    });

    it('refuses a server action (POST on a page URL) with 503 JSON, no rewrite', async () => {
      const res = (await middleware(
        request('/fr/experiences/degustation', { method: 'POST' })
      )) as NextResponse;

      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('600');
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      expect(await res.json()).toMatchObject({ error: 'maintenance' });
    });

    it.each([
      ['POST', '/api/auth/sign-in/email'],
      ['POST', '/api/newsletter'],
      ['POST', '/api/unsubscribe/some-token'],
      ['DELETE', '/api/anything'],
      ['PUT', '/api/anything'],
      ['PATCH', '/api/anything'],
    ])('refuses the mutating API call %s %s', async (method, path) => {
      const res = (await middleware(request(path, { method }))) as NextResponse;

      expect(res.status).toBe(503);
      expect(res.headers.get('retry-after')).toBe('600');
      expect(await res.json()).toMatchObject({ error: 'maintenance' });
    });

    it.each([
      // Stripe disables an endpoint that keeps failing — webhooks stay open.
      ['POST', '/api/webhooks/stripe/checkout'],
      ['POST', '/api/webhooks/stripe/connect'],
      ['POST', '/api/webhooks/resend'],
      ['GET', '/api/cron/reminders'],
      ['POST', '/api/cron/reminders'],
      ['GET', '/api/health'],
      // Reads keep working.
      ['GET', '/api/auth/get-session'],
      ['GET', '/api/geocode/search'],
      ['HEAD', '/api/health'],
    ])('lets %s %s through untouched', async (method, path) => {
      const res = (await middleware(request(path, { method }))) as NextResponse;

      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    });

    it('static files are never rewritten', async () => {
      const res = (await middleware(
        request('/icons/encave-logo.png')
      )) as NextResponse;

      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    });
  });

  describe('switch OFF (fail-open: only the exact string "true" closes the site)', () => {
    it.each([undefined, '', 'false', 'TRUE', '1', 'yes'])(
      'MAINTENANCE_MODE=%s → normal traffic',
      async (value) => {
        const middleware = await load({
          MAINTENANCE_MODE: value,
          COMING_SOON: 'false',
        });

        const page = (await middleware(request('/fr'))) as NextResponse;
        expect(page.status).toBe(200);
        expect(page.headers.get('x-middleware-rewrite')).toBeNull();

        const api = (await middleware(
          request('/api/newsletter', { method: 'POST' })
        )) as NextResponse;
        expect(api.status).toBe(200);
        expect(api.headers.get('x-middleware-next')).toBe('1');
      }
    );
  });

  it('the API matcher is registered (otherwise the freeze never sees /api)', async () => {
    const mod = await import('@/middleware');
    expect(mod.config.matcher).toContain('/api/:path*');
  });
});
