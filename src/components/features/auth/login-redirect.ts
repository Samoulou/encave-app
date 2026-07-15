/**
 * Post-login redirect resolution, shared by the password, OTP and 2FA login
 * paths (P-14). Guards against open redirects and routes by role.
 */

/** Same-origin relative path only (no protocol-relative / host change). */
export function isValidReturnUrl(url: string): boolean {
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false;
  }
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.host === 'localhost';
  } catch {
    return false;
  }
}

/** Locale-agnostic path (the i18n router prefixes the locale). */
export function resolveLoginRedirect(
  role: string | undefined,
  searchParams: URLSearchParams
): string {
  const callbackUrl =
    searchParams.get('callbackUrl') || searchParams.get('returnUrl');
  if (callbackUrl && isValidReturnUrl(callbackUrl)) {
    return callbackUrl;
  }
  if (role === 'ADMIN') return '/admin';
  if (role === 'WINEMAKER') return '/dashboard/bookings';
  return '/dashboard';
}
