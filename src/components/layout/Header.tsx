import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileBackButton } from '@/components/layout/MobileBackButton';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/50 bg-cream-50/90 backdrop-blur-[14px] md:border-border/60 md:bg-white/95 md:backdrop-blur-md md:supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto grid h-[52px] max-w-7xl grid-cols-[40px_1fr_40px] items-center px-[10px] md:flex md:h-20 md:justify-between md:px-6 lg:px-8">
        <div className="md:hidden">
          <MobileBackButton />
        </div>

        <Link
          href="/"
          className="group hidden items-center gap-2 md:flex"
          aria-label={t('goToHomepage')}
        >
          <Image
            src="/icons/encave-logo.png"
            alt="EnCave"
            width={200}
            height={56}
            className="h-14 w-auto"
            priority
          />
        </Link>

        <Link
          href="/"
          className="justify-self-center font-display text-base font-semibold tracking-[-0.01em] text-ink-900 md:hidden"
        >
          EnCave
        </Link>

        <nav
          aria-label={t('mainNavigation')}
          className="hidden items-center gap-8 md:flex"
        >
          <NavLink href="/wineries">{t('wineries')}</NavLink>
          <NavLink href="/experiences">{t('experiences')}</NavLink>
          <NavLink href="/about">{t('about')}</NavLink>
          {userRole === 'ADMIN' && (
            <NavLink href="/admin">{t('admin')}</NavLink>
          )}
          {userRole === 'WINEMAKER' && (
            <NavLink href="/dashboard">{t('dashboard')}</NavLink>
          )}
          {userRole === 'CLIENT' && (
            <NavLink href="/dashboard/my-bookings">{t('myBookings')}</NavLink>
          )}
        </nav>

        {/* Desktop auth section - hidden on mobile */}
        <div className="hidden items-center gap-4 md:flex">
          <LocaleSwitcher />
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          {session?.user ? (
            <UserMenu
              userName={session.user.name}
              userRole={session.user.role}
              userEmail={session.user.email}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">{t('signIn')}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t('getStarted')}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile navigation */}
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
