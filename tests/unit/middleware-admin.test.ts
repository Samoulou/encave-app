import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import middleware from '@/middleware';

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${path}`), {
    headers: cookie ? { cookie } : undefined,
  });
}

async function run(path: string, cookie?: string): Promise<NextResponse> {
  return (await middleware(request(path, cookie))) as NextResponse;
}

/**
 * P-06 (L-212): the middleware no longer resolves the session role (the
 * Edge→Node fetch is gone). It only short-circuits anonymous visitors;
 * role enforcement lives in admin/layout.tsx (auth() + notFound()).
 */
describe('admin middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects anonymous admin requests to localized login with callbackUrl', async () => {
    const response = await run('/fr/admin/wineries');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/fr/login?callbackUrl=%2Ffr%2Fadmin%2Fwineries'
    );
  });

  it('lets cookie-bearing admin requests through without any session fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await run(
      '/fr/admin',
      'better-auth.session_token=session-token'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    // The role gate is the admin layout, not an Edge fetch.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('redirects anonymous users on protected routes to login', async () => {
    const response = await run('/fr/dashboard');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/fr/login?callbackUrl=%2Ffr%2Fdashboard'
    );
  });

  it('never calls the session endpoint, whatever the route', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await run('/fr/dashboard', 'better-auth.session_token=session-token');
    await run('/fr/admin', 'better-auth.session_token=session-token');
    await run('/fr/experiences');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
