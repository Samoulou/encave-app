import Link from 'next/link';
import { Wine } from 'lucide-react';
import { auth } from '@/server/auth';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';
import { NavLink } from '@/components/layout/NavLink';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';

export async function Header() {
  const session = await auth();
  const userRole = session?.user?.role;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="EnCave - Go to homepage"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-600 text-white transition-colors group-hover:bg-burgundy-700">
            <Wine className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className="font-display text-2xl font-semibold text-burgundy-800">
            EnCave
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-8">
          <NavLink href="/wineries">Wineries</NavLink>
          <NavLink href="/experiences">Experiences</NavLink>
          {userRole === 'ADMIN' && (
            <NavLink href="/admin">Admin</NavLink>
          )}
          {userRole === 'WINEMAKER' && (
            <NavLink href="/dashboard">Dashboard</NavLink>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <div className="h-5 w-px bg-slate-200" aria-hidden="true" />
          {session?.user ? (
            <UserMenu userName={session.user.name} />
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
