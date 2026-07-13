import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { NavLink } from '@/components/layout/NavLink';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileBackButton } from '@/components/layout/MobileBackButton';
import { HeaderAuthSlot } from '@/components/layout/HeaderAuthSlot';
import { HeaderRoleLink } from '@/components/layout/HeaderRoleLink';
import { LocaleCurrencyChip } from '@/components/shared/LocaleCurrencyChip';

/**
 * Static server component (P-06 / L-202): no auth()/headers() here —
 * that single call used to force EVERY public page into per-request
 * rendering. Session-dependent bits live in client islands
 * (HeaderAuthSlot, HeaderRoleLink, MobileNav's useSession), which share
 * one better-auth store → one GET /api/auth/get-session per page load.
 */
export async function Header() {
  const t = await getTranslations('nav');
  // Gift cards entry point (P-09), flag-gated. isFlagEnabled is
  // unstable_cache-backed → no per-request rendering, ISR-safe.
  const giftCardsEnabled = await isFlagEnabled('GIFT_CARDS');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-cream-50/90 backdrop-blur-[14px] md:border-stone-200 md:bg-cream-100/80 md:supports-[backdrop-filter]:bg-cream-100/70">
      <div className="mx-auto grid h-[52px] max-w-7xl grid-cols-[40px_1fr_40px] items-center px-[10px] md:flex md:h-16 md:gap-6 md:px-6 lg:px-8 xl:px-10">
        <div className="md:hidden">
          <MobileBackButton />
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-6 md:flex lg:gap-8">
          <Link
            href="/"
            className="shrink-0 font-display text-2xl font-semibold tracking-[-0.01em] text-burgundy-700"
            aria-label={t('goToHomepage')}
          >
            EnCave
          </Link>

          <nav
            aria-label={t('mainNavigation')}
            className="hidden min-w-0 items-center gap-4 md:flex lg:gap-6"
          >
            <NavLink
              href="/experiences"
              className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('experiences')}
            </NavLink>
            <NavLink
              href="/wineries"
              className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('wineries')}
            </NavLink>
            <NavLink
              href="/about"
              className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('about')}
            </NavLink>
            {giftCardsEnabled && (
              <NavLink
                href="/cadeaux"
                className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
                activeClassName="text-ink-900"
              >
                {t('giftCards')}
              </NavLink>
            )}
            <HeaderRoleLink />
          </nav>
        </div>

        <Link
          href="/"
          className="justify-self-center font-display text-base font-semibold tracking-[-0.01em] text-ink-900 md:hidden"
        >
          EnCave
        </Link>

        <div className="hidden shrink-0 items-center gap-2 md:flex lg:gap-3.5">
          <LocaleCurrencyChip />
          <HeaderAuthSlot />
        </div>

        <div className="justify-self-end md:hidden">
          <MobileNav giftCardsEnabled={giftCardsEnabled} />
        </div>
      </div>
    </header>
  );
}
