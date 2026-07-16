import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/better-auth';
import { logInfo } from '@/lib/logger';

/**
 * G-3 landing (P-16 / WS-G): revokes the current session then sends the
 * user to the login page. The admin layout redirects here when a session
 * outlives its role window — an RSC render cannot clear cookies itself.
 */
export async function GET(request: NextRequest) {
  const locale = ['fr', 'de', 'en'].includes(
    request.nextUrl.searchParams.get('locale') ?? ''
  )
    ? request.nextUrl.searchParams.get('locale')
    : 'fr';

  const redirectResponse = NextResponse.redirect(
    new URL(`/${locale}/login?callbackUrl=/${locale}/admin`, request.url)
  );

  try {
    const signOutResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    // Carry the session-clearing cookies onto the redirect.
    signOutResponse.headers
      .getSetCookie()
      .forEach((cookie) =>
        redirectResponse.headers.append('set-cookie', cookie)
      );
    logInfo('expired admin session revoked (G-3)', {
      action: 'sessionExpiredRoute',
    });
  } catch {
    // No active session (double visit) — the redirect alone is fine.
  }

  return redirectResponse;
}
