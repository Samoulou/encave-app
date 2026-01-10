import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');
  const tCommon = await getTranslations('common');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="mb-2 text-2xl font-bold">{t('pageNotFound')}</h2>
      <p className="mb-4 text-slate-600">
        {t('pageNotFoundDescription')}
      </p>
      <Button asChild>
        <Link href="/">{tCommon('buttons.goHome')}</Link>
      </Button>
    </div>
  );
}
