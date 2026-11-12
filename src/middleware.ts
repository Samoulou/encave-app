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

// Write-freeze switch (docs/runbooks/restauration-db.md). Env-based for the
// same reason as COMING_SOON — the Edge middleware cannot read the DB — so
// the flip is a Vercel env change (MAINTENANCE_MODE=true) + redeploy, and
// lifting it is the same operation. Fail-OPEN: only the exact string 'true'
// closes the site (a typo must never take production down).
const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

/** Seconds a client / crawler is asked to wait before retrying. */
const MAINTENANCE_RETRY_AFTER = '600';

/**
 * API routes that keep answering during a freeze:
 *  - webhooks: Stripe/Resend retry on 5xx and Stripe DISABLES an endpoint
 *    that keeps failing — they must stay accepted (their handlers are
 *    idempotent; events are replayable, see the restore runbook);
 *  - crons: authenticated by CRON_SECRET, they finish what is in flight;
 *  - health: the external monitor must keep seeing the real state.
 */
const MAINTENANCE_API_EXEMPT_PREFIXES = [
  '/api/webhooks/',
  '/api/cron/',
  '/api/health',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function maintenanceRefusal(): NextResponse {
  return NextResponse.json(
    {
      error: 'maintenance',
      message: 'EnCave is under maintenance. Please retry in a few minutes.',
    },
    {
      status: 503,
      headers: {
        'Retry-After': MAINTENANCE_RETRY_AFTER,
        'Cache-Control': 'no-store',
      },
    }
  );
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get('host') ?? '';

  // API routes: untouched, except that a write freeze refuses the MUTATING
  // ones (reads keep working — a GET cannot write through our handlers'
  // contract; the exempt list is documented above).
  if (pathname.startsWith('/api')) {
    if (
      isMaintenanceMode &&
      !SAFE_METHODS.has(request.method) &&
      !MAINTENANCE_API_EXEMPT_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
      )
    ) {
      return maintenanceRefusal();
    }
    return NextResponse.next();
  }

  // Skip middleware for static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Maintenance: every page shows /[locale]/maintenance. Takes precedence
  // over the Coming Soon gate and over auth redirects.
  if (isMaintenanceMode) {
    // Server actions are POSTs on page URLs: refuse them like a mutating
    // API call — rewriting one to an HTML page would break the client.
    if (!SAFE_METHODS.has(request.method)) {
      return maintenanceRefusal();
    }
    const locale = getLocaleFromPathname(pathname);
    // 503 + Retry-After, not 200: crawlers must not index the maintenance
    // copy in place of the real pages, nor drop them from the index.
    return NextResponse.rewrite(
      new URL(`/${locale}/maintenance`, request.url),
      {
        status: 503,
        headers: {
          'Retry-After': MAINTENANCE_RETRY_AFTER,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // The coming-soon page lives outside [locale] (locale-less) — without a
  // pass-through here, the intl middleware 307s it to /fr/coming-soon (404).
  // While the gate is up it is served on ANY host (encave.ch + previews +
  // localhost, so the page stays reviewable). Once the gate is down
  // (post-launch), production redirects home — pre-launch links must not
  // keep advertising the founder offer — while non-prod hosts keep it
  // viewable for review.
  if (pathname === '/coming-soon') {
    const isProductionHost =
      hostname === COMING_SOON_DOMAIN ||
      hostname === `www.${COMING_SOON_DOMAIN}`;
    if (isComingSoonGateUp || !isProductionHost) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/', request.url));
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
     * - api (API routes — handled by the dedicated matcher below)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    /*
     * API routes: matched ONLY so that MAINTENANCE_MODE can refuse the
     * mutating ones (the matcher is static — it cannot depend on the env).
     * Outside maintenance the middleware returns next() on the first line.
     */
    '/api/:path*',
  ],
};
