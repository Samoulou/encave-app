import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';

export function Footer() {
  const t = useTranslations('landing.footer');
  const tNav = useTranslations('nav');
  const tLegal = useTranslations('legal');
  const tFooter = useTranslations('footer');

  return (
    <footer className="bg-[#1a1215] text-burgundy-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/icons/encave-logo.png"
                alt="EnCave"
                width={160}
                height={46}
                className="h-11 w-auto brightness-0 invert"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-burgundy-400">
              {tFooter('brandDescription')}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="mb-4 font-display text-sm font-semibold text-white">
              {tFooter('navigation')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/" className="transition-colors hover:text-white">
                  {tNav('home')}
                </Link>
              </li>
              <li>
                <Link
                  href="/experiences"
                  className="transition-colors hover:text-white"
                >
                  {tNav('experiences')}
                </Link>
              </li>
              <li>
                <Link
                  href="/wineries"
                  className="transition-colors hover:text-white"
                >
                  {tNav('wineries')}
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="transition-colors hover:text-white"
                >
                  {tNav('about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Discover (SEO Landing Pages) */}
          <div>
            <h3 className="mb-4 font-display text-sm font-semibold text-white">
              {t('discover')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/degustation-vin-valais"
                  className="transition-colors hover:text-white"
                >
                  {t('degustation')}
                </Link>
              </li>
              <li>
                <Link
                  href="/cepages-valaisans"
                  className="transition-colors hover:text-white"
                >
                  {t('cepages')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 font-display text-sm font-semibold text-white">
              {tFooter('legal')}
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/legal/privacy"
                  className="transition-colors hover:text-white"
                >
                  {tLegal('privacy.title')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/terms"
                  className="transition-colors hover:text-white"
                >
                  {tLegal('terms.title')}
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/cancellation"
                  className="transition-colors hover:text-white"
                >
                  {tLegal('cancellation.title')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-burgundy-800 pt-8 sm:flex-row">
          <p className="text-sm text-burgundy-400">
            © {new Date().getFullYear()} EnCave. {tFooter('allRightsReserved')}
          </p>
          <a
            href="mailto:samuel@encave.ch"
            className="flex items-center gap-2 text-sm text-burgundy-400 transition-colors hover:text-white"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            samuel@encave.ch
          </a>
        </div>
      </div>
    </footer>
  );
}
