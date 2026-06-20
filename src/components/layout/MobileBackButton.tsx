'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export function MobileBackButton() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === '/';

  if (isHome) {
    return <div className="h-10 w-10" aria-hidden="true" />;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-10 rounded-full text-ink-900 md:hidden"
      aria-label={t('buttons.back')}
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
