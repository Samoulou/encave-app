import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Mail, MapPin, ShieldCheck, Wine } from 'lucide-react';

export function Footer() {
  const t = useTranslations('landing.footer');
  const tNav = useTranslations('nav');
  const tLegal = useTranslations('legal');
  const tFooter = useTranslations('footer');

  return (
    <footer className="border-t border-stone-200 bg-cream-200 text-ink-700">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
        <div className="grid gap-8 border-b border-stone-200 pb-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr]">
          <div>
            <Link
              href="/"
              className="font-display text-2xl font-semibold text-burgundy-700"
            >
              EnCave
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-500">
              {tFooter('brandDescription')}
            </p>
            <div className="mt-5 grid gap-2 text-sm text-ink-700">
              <span className="inline-flex items-center gap-2">
                <MapPin
                  className="h-4 w-4 text-burgundy-600"
                  aria-hidden="true"
                />
                {tFooter('region')}
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-burgundy-600"
                  aria-hidden="true"
                />
                {tFooter('securePayment')}
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
              {tFooter('navigation')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tNav('home')}
                </Link>
              </li>
              <li>
                <Link
                  href="/experiences"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tNav('experiences')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wineries"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tNav('wineries')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tNav('about')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
              {t('discover')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/degustation-vin-valais"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {t('degustation')}
                </Link>
              </li>
              <li>
                <Link
                  href="/cepages-valaisans"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {t('cepages')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
              {tFooter('legal')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/legal/privacy"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tLegal('privacy.title')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tLegal('terms.title')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cancellation"
                  className="transition-colors hover:text-burgundy-700"
                >
                  {tLegal('cancellation.title')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-6 text-sm text-ink-500 sm:flex-row sm:items-center">
          <p>
            Copyright {new Date().getFullYear()} EnCave.{' '}
            {tFooter('allRightsReserved')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <Wine className="h-4 w-4 text-burgundy-600" aria-hidden="true" />
              {tFooter('wineExperiences')}
            </span>
            <a
              href="mailto:samuel@encave.ch"
              className="inline-flex items-center gap-2 transition-colors hover:text-burgundy-700"
            >
              <Mail className="h-4 w-4 text-burgundy-600" aria-hidden="true" />
              samuel@encave.ch
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
