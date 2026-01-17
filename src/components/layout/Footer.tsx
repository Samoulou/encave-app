import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Wine, Mail } from 'lucide-react';

export function Footer() {
  const t = useTranslations('landing.footer');
  const tNav = useTranslations('nav');
  const tLegal = useTranslations('legal');

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Wine className="h-6 w-6 text-burgundy-400" aria-hidden="true" />
              <span className="font-display text-xl font-bold text-white">EnCave</span>
            </Link>
            <p className="mt-4 text-sm text-slate-400 max-w-xs">
              Plateforme de réservation d&apos;expériences viticoles en Valais, Suisse.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-4">Navigation</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  {tNav('home')}
                </Link>
              </li>
              <li>
                <Link href="/experiences" className="hover:text-white transition-colors">
                  {tNav('experiences')}
                </Link>
              </li>
              <li>
                <Link href="/wineries" className="hover:text-white transition-colors">
                  {tNav('wineries')}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {tNav('about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Discover (SEO Landing Pages) */}
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-4">{t('discover')}</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/degustation-vin-valais" className="hover:text-white transition-colors">
                  {t('degustation')}
                </Link>
              </li>
              <li>
                <Link href="/cepages-valaisans" className="hover:text-white transition-colors">
                  {t('cepages')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-display text-sm font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/legal/privacy" className="hover:text-white transition-colors">
                  {tLegal('privacy.title')}
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-white transition-colors">
                  {tLegal('terms.title')}
                </Link>
              </li>
              <li>
                <Link href="/legal/cancellation" className="hover:text-white transition-colors">
                  {tLegal('cancellation.title')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} EnCave. All rights reserved.
          </p>
          <a
            href="mailto:samuel@encave.ch"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            samuel@encave.ch
          </a>
        </div>
      </div>
    </footer>
  );
}
