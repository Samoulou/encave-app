import Link from 'next/link';
import { auth } from '@/server/auth';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/components/features/auth/UserMenu';

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-burgundy-700">
          EnCave
        </Link>
        <nav className="flex items-center gap-4">
          {session?.user ? (
            <UserMenu userName={session.user.name} />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
