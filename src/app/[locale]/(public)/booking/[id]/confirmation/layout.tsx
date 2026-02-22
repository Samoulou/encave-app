import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Wine, Lock } from 'lucide-react';

export default async function ConfirmationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('confirmation');

  return (
    <div className="min-h-screen bg-[#f8f6f6] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#f2e9eb] bg-[#f8f6f6]/95 backdrop-blur-sm px-4 md:px-10 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-3 group"
            aria-label="EnCave - Go to homepage"
          >
            <div className="flex h-8 w-8 items-center justify-center text-primary">
              <Wine className="h-8 w-8" aria-hidden="true" />
            </div>
            <span className="text-foreground text-xl font-bold tracking-tight">
              EnCave
            </span>
          </Link>

          {/* Booking Confirmed Badge */}
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium bg-green-100 px-3 py-1.5 rounded-full">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>{t('bookingConfirmed')}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
