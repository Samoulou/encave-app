import { getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileBackButton } from '@/components/layout/MobileBackButton';
import { HeaderSearchPill } from '@/components/layout/HeaderSearchPill';
import { LocaleCurrencyChip } from '@/components/shared/LocaleCurrencyChip';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/50 bg-cream-50/90 backdrop-blur-[14px] md:border-stone-200 md:bg-white md:backdrop-blur-none md:supports-[backdrop-filter]:bg-white">
      <div className="mx-auto grid h-[52px] max-w-7xl grid-cols-[40px_1fr_40px] items-center px-[10px] md:flex md:h-16 md:justify-between md:px-10 lg:px-10">
        <div className="md:hidden">
          <MobileBackButton />
        </div>

        <div className="hidden min-w-0 items-center gap-8 md:flex">
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

        <Link
          href="/"
          className="justify-self-center font-display text-base font-semibold tracking-[-0.01em] text-ink-900 md:hidden"
        >
          EnCave
        </Link>

        <div className="mx-8 hidden max-w-[520px] flex-1 md:flex">
          <HeaderSearchPill />
        </div>

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

        <div className="justify-self-end md:hidden">
          <MobileNav
            isAuthenticated={!!session?.user}
            userName={session?.user?.name}
            userRole={userRole}
          />
        </div>
      </div>
    </header>
  );
}
