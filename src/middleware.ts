import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (without locale prefix)
const protectedPatterns = ['/dashboard', '/onboarding'];

// Routes that require ADMIN role (without locale prefix)
const adminPatterns = ['/admin'];

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

function redirectToLogin(
  request: NextRequest,
  locale: string,
  pathname: string
): NextResponse {
  const loginUrl = new URL(`/${locale}/login`, request.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  return NextResponse.redirect(loginUrl);
}

// Production domain gated by the Coming Soon flag
const COMING_SOON_DOMAIN = 'encave.ch';

// P-16 (WS-I, L-189): the gate is env-based, NOT hardcoded — the launch
// flip is a Vercel env change (COMING_SOON=false) + redeploy (~2 min),
// and the rollback is the exact same operation. Env because the Edge
// middleware cannot read the DB flag table; the only legitimately
// env-based flag (documented in src/lib/flags.ts). Any value but the
// string 'false' keeps the gate up — fail-closed pre-launch.
const isComingSoonGateUp = process.env.COMING_SOON !== 'false';

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

  // The coming-soon page lives outside [locale] (locale-less) — serve it
  // directly on ANY host. Without this, the intl middleware 307s it to
  // /fr/coming-soon (404) and the page is unreviewable on previews/localhost.
  // On encave.ch the behavior is unchanged (it was already passed through).
  if (pathname === '/coming-soon') {
    return NextResponse.next();
  }

  // Coming Soon: redirect the production domain to the coming-soon page
  // until COMING_SOON=false flips the gate (launch bascule, WS-I).
  if (
    isComingSoonGateUp &&
    (hostname === COMING_SOON_DOMAIN ||
      hostname === `www.${COMING_SOON_DOMAIN}`)
  ) {
    // Allow article pages (accessible from coming-soon footer)
    const pathnameNoLocale = getPathnameWithoutLocale(pathname);
    const allowedPaths = ['/degustation-vin-valais', '/cepages-valaisans'];
    if (allowedPaths.some((p) => pathnameNoLocale === p)) {
      return intlMiddleware(request);
    }
    // Founder invitation links must work pre-launch (P-14 / L-154) — onboard
    // the first wineries before the gate is lifted.
    if (pathnameNoLocale.startsWith('/invitation/')) {
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

  // Note: Auth route access control (redirect if already logged in) is handled
  // server-side in (auth)/layout.tsx via session validation, not cookie presence.
  // This avoids redirect loops when session cookies are expired but still present.

  // /admin role enforcement lives in admin/layout.tsx (auth() + role +
  // suspension → notFound()). The middleware used to duplicate it with an
  // Edge→Node fetch per navigation — removed in P-06 (L-212): the cookie
  // presence check above still short-circuits anonymous visitors.

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
