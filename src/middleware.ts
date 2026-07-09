import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (without locale prefix)
const protectedPatterns = ['/dashboard', '/onboarding'];

// Routes that require ADMIN role (without locale prefix)
const adminPatterns = ['/admin'];
const ADMIN_ROLE = 'ADMIN';

// Auth routes (login/register) — access control handled server-side in (auth)/layout.tsx

// Helper to extract pathname without locale prefix
function getPathnameWithoutLocale(pathname: string): string {
  const localePattern = new RegExp(`^/(${routing.locales.join('|')})`);
  return pathname.replace(localePattern, '') || '/';
}

// Helper to get the current locale from pathname
function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(new RegExp(`^/(${routing.locales.join('|')})`));
  return match?.[1] ?? routing.defaultLocale;
}

function rewriteNotFound(request: NextRequest, locale: string): NextResponse {
  return NextResponse.rewrite(new URL(`/${locale}/not-found`, request.url), {
    status: 404,
  });
}

function redirectToLogin(
  request: NextRequest,
  locale: string,
  pathname: string
): NextResponse {
  const loginUrl = new URL(`/${locale}/login`, request.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

async function getSessionRole(
  request: NextRequest
): Promise<'NO_SESSION' | 'ROLE_MISSING' | string> {
  try {
    const response = await fetch(
      new URL('/api/auth/get-session', request.url),
      {
        headers: {
          cookie: request.headers.get('cookie') ?? '',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) return 'NO_SESSION';

    const session = (await response.json()) as {
      user?: { role?: string | null };
    } | null;

    if (!session?.user) return 'NO_SESSION';
    return session.user.role ?? 'ROLE_MISSING';
  } catch {
    return 'NO_SESSION';
  }
}

// Production domain that should show "Coming Soon"
const COMING_SOON_DOMAIN = 'encave.ch';

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get('host') ?? '';

  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Coming Soon: Redirect production domain to coming-soon page
  // Remove this block when ready to launch
  if (
    hostname === COMING_SOON_DOMAIN ||
    hostname === `www.${COMING_SOON_DOMAIN}`
  ) {
    // Allow the coming-soon page itself
    if (pathname === '/coming-soon') {
      return NextResponse.next();
    }

    // Allow article pages (accessible from coming-soon footer)
    const pathnameNoLocale = getPathnameWithoutLocale(pathname);
    const allowedPaths = ['/degustation-vin-valais', '/cepages-valaisans'];
    if (allowedPaths.some((p) => pathnameNoLocale === p)) {
      return intlMiddleware(request);
    }

    // Redirect everything else to coming-soon
    return NextResponse.redirect(new URL('/coming-soon', request.url));
  }

  // First, apply the intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // If intl middleware returned a redirect (e.g., for locale detection), honor it
  if (
    intlResponse.headers.get('x-middleware-rewrite') ||
    intlResponse.status === 307
  ) {
    return intlResponse;
  }

  // For auth checks, we need to check the session
  // Since next-auth middleware doesn't easily chain, we'll use a different approach
  // We'll check for the session token in cookies

  // Better Auth session cookie names
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const isLoggedIn = !!sessionToken;
  const pathnameWithoutLocale = getPathnameWithoutLocale(pathname);
  const locale = getLocaleFromPathname(pathname);

  const isProtectedRoute = protectedPatterns.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isAdminRoute = adminPatterns.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  // Redirect unauthenticated users from protected routes to login
  if ((isProtectedRoute || isAdminRoute) && !isLoggedIn) {
    return redirectToLogin(request, locale, pathname);
  }

  if (isAdminRoute) {
    const role = await getSessionRole(request);
    if (role === 'NO_SESSION' || role === 'ROLE_MISSING') {
      return redirectToLogin(request, locale, pathname);
    }
    if (role !== ADMIN_ROLE) {
      return rewriteNotFound(request, locale);
    }
  }

  // Note: Auth route access control (redirect if already logged in) is handled
  // server-side in (auth)/layout.tsx via session validation, not cookie presence.
  // This avoids redirect loops when session cookies are expired but still present.

  // Admin layout keeps a second role check as defense in depth.

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
