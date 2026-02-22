import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { MobileNav } from '@/components/layout/MobileNav';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;
  const t = await getTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 group"
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

        <nav aria-label={t('mainNavigation')} className="hidden md:flex items-center gap-8">
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
        <div className="hidden md:flex items-center gap-4">
          <LocaleSwitcher />
          <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
          {session?.user ? (
            <UserMenu userName={session.user.name} />
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
        <MobileNav
          isAuthenticated={!!session?.user}
          userName={session?.user?.name}
          userRole={userRole}
        />
      </div>
    </header>
  );
}
