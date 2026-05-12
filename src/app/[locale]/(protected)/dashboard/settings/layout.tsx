import { getTranslations } from 'next-intl/server';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('settings');

  return (
    <WineryAccessGuard>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-display-md text-slate-900">
            {t('title')}
          </h1>
          <p className="text-slate-600">{t('subtitle')}</p>
        </div>
        {children}
      </div>
    </WineryAccessGuard>
  );
}
