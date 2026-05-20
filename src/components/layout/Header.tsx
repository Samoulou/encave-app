import { getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileBackButton } from '@/components/layout/MobileBackButton';
import { LocaleCurrencyChip } from '@/components/shared/LocaleCurrencyChip';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/50 bg-cream-50/90 backdrop-blur-[14px] md:border-stone-200 md:bg-white md:backdrop-blur-none md:supports-[backdrop-filter]:bg-white">
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
            {userRole === 'ADMIN' && (
              <NavLink
                href="/admin"
                className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
              >
                {t('admin')}
              </NavLink>
            )}
            {userRole === 'WINEMAKER' && (
              <NavLink
                href="/dashboard"
                className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
              >
                {t('dashboard')}
              </NavLink>
            )}
            {userRole === 'CLIENT' && (
              <NavLink
                href="/dashboard/my-bookings"
                className="whitespace-nowrap py-[23px] text-[13px] lg:text-[13.5px]"
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

        <div className="hidden shrink-0 items-center gap-2 md:flex lg:gap-3.5">
          <LocaleCurrencyChip />
          {session?.user ? (
            <UserMenu
              userName={session.user.name}
              userRole={session.user.role}
              userEmail={session.user.email}
            />
          ) : (
            <div className="flex items-center gap-2 lg:gap-3">
              <Button
                variant="outline"
                className="h-9 rounded-full border-stone-200 px-3 text-[12.5px] font-semibold text-ink-900 lg:px-4"
                asChild
              >
                <Link href="/login">{t('signIn')}</Link>
              </Button>
              <Button
                className="h-9 rounded-full bg-burgundy-600 px-3 text-[12.5px] font-semibold text-white hover:bg-burgundy-700 lg:px-4"
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
