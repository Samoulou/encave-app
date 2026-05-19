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

  it('allows ADMIN sessions through', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ user: { role: 'ADMIN' } })
    );

    const response = await run(
      '/fr/admin',
      'better-auth.session_token=session-token'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('rewrites authenticated non-admin users to not-found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ user: { role: 'WINEMAKER' } })
    );

    const response = await run(
      '/fr/admin/wineries',
      'better-auth.session_token=session-token'
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/fr/not-found'
    );
  });

  it('fails closed to login when the session is unreadable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );

    const response = await run(
      '/fr/admin',
      'better-auth.session_token=session-token'
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/fr/login?callbackUrl=%2Ffr%2Fadmin'
    );
  });

  it('does not call the session endpoint for non-admin protected routes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await run(
      '/fr/dashboard',
      'better-auth.session_token=session-token'
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
