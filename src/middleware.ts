import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (without locale prefix)
const protectedPatterns = ['/dashboard', '/onboarding'];

// Routes that require ADMIN role (without locale prefix)
const adminPatterns = ['/admin'];

// Routes that should redirect to home if already authenticated (without locale prefix)
const authPatterns = ['/login', '/register'];

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
    // Redirect everything else to coming-soon
    return NextResponse.redirect(new URL('/coming-soon', request.url));
  }

  // First, apply the intl middleware for locale handling
  const intlResponse = intlMiddleware(request);

  // If intl middleware returned a redirect (e.g., for locale detection), honor it
  if (intlResponse.headers.get('x-middleware-rewrite') || intlResponse.status === 307) {
    return intlResponse;
  }

  // For auth checks, we need to check the session
  // Since next-auth middleware doesn't easily chain, we'll use a different approach
  // We'll check for the session token in cookies


  const sessionToken = request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;



  const isLoggedIn = !!sessionToken;
  const pathnameWithoutLocale = getPathnameWithoutLocale(pathname);
  const locale = getLocaleFromPathname(pathname);

  const isProtectedRoute = protectedPatterns.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isAdminRoute = adminPatterns.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isAuthRoute = authPatterns.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to login
  if ((isProtectedRoute || isAdminRoute) && !isLoggedIn) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth routes to home
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // Note: Admin role check requires session data which needs server-side check
  // This will be handled in the admin layout for now

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