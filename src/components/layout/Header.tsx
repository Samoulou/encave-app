import { getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { MobileNav } from '@/components/layout/MobileNav';
import { HeaderSearchPill } from '@/components/layout/HeaderSearchPill';
import { LocaleCurrencyChip } from '@/components/shared/LocaleCurrencyChip';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 md:border-stone-200 md:bg-white md:backdrop-blur-none md:supports-[backdrop-filter]:bg-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16 md:px-10 lg:px-10">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/"
            className="font-display text-2xl font-semibold tracking-[-0.01em] text-burgundy-700"
            aria-label={t('goToHomepage')}
          >
            EnCave
          </Link>

          <nav
            aria-label={t('mainNavigation')}
            className="hidden items-center gap-6 md:flex"
          >
            <NavLink
              href="/experiences"
              className="py-[23px] text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('experiences')}
            </NavLink>
            <NavLink
              href="/wineries"
              className="py-[23px] text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('wineries')}
            </NavLink>
            <NavLink
              href="/about"
              className="py-[23px] text-[13.5px]"
              activeClassName="text-ink-900"
            >
              {t('about')}
            </NavLink>
            {userRole === 'ADMIN' && (
              <NavLink href="/admin" className="py-[23px] text-[13.5px]">
                {t('admin')}
              </NavLink>
            )}
            {userRole === 'WINEMAKER' && (
              <NavLink href="/dashboard" className="py-[23px] text-[13.5px]">
                {t('dashboard')}
              </NavLink>
            )}
            {userRole === 'CLIENT' && (
              <NavLink
                href="/dashboard/my-bookings"
                className="py-[23px] text-[13.5px]"
              >
                {t('myBookings')}
              </NavLink>
            )}
          </nav>
        </div>

        <div className="mx-8 hidden max-w-[520px] flex-1 md:flex">
          <HeaderSearchPill />
        </div>

        {/* Desktop auth section - hidden on mobile */}
        <div className="hidden items-center gap-3.5 md:flex">
          <LocaleCurrencyChip />
          {session?.user ? (
            <UserMenu
              userName={session.user.name}
              userRole={session.user.role}
              userEmail={session.user.email}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-9 rounded-full border-stone-200 px-4 text-[12.5px] font-semibold text-ink-900"
                asChild
              >
                <Link href="/login">{t('signIn')}</Link>
              </Button>
              <Button
                className="h-9 rounded-full bg-burgundy-600 px-4 text-[12.5px] font-semibold text-white hover:bg-burgundy-700"
                asChild
              >
                <Link href="/register">{t('getStarted')}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile navigation */}
        <MobileNav
          isAuthenticated={!!session?.user}
          userName={session?.user?.name}
          userRole={userRole}
        />
      </div>
    </header>
  );
}
