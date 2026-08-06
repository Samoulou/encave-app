import { getRequestConfig } from 'next-intl/server';
import { IntlErrorCode } from 'next-intl';
import { logError } from '@/lib/logger';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (
    !locale ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // P-06 (L-203): client providers ship namespace SUBSETS — a missed
    // namespace must fail loudly in dev/CI instead of rendering a raw
    // key in production.
    onError(error) {
      if (
        error.code === IntlErrorCode.MISSING_MESSAGE &&
        process.env.NODE_ENV !== 'production'
      ) {
        throw error;
      }
      // Production included: a missed namespace must reach Pino/Sentry,
      // not vanish (the dev/CI guards don't cover prod-only locales).
      logError('next-intl error', error, { action: 'i18nOnError' });
    },
  };
});
