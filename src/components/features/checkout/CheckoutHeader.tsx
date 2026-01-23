import { Wine, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

export async function CheckoutHeader() {
  const t = await getTranslations('checkout');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#f2e9eb] bg-[#f8f6f6]/95 backdrop-blur-sm px-4 md:px-10 py-4">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="EnCave - Go to homepage"
        >
          <div className="flex h-8 w-8 items-center justify-center text-primary">
            <Wine className="h-8 w-8" aria-hidden="true" />
          </div>
          <span className="text-[#1a0f12] text-xl font-bold tracking-tight">
            EnCave
          </span>
        </Link>

        {/* Secure Checkout Badge */}
        <div className="flex items-center gap-2 text-[#915564] text-sm font-medium bg-[#f2e9eb] px-3 py-1.5 rounded-full">
          <Lock className="h-4 w-4" aria-hidden="true" />
          <span>{t('secureCheckout')}</span>
        </div>
      </div>
    </header>
  );
}
