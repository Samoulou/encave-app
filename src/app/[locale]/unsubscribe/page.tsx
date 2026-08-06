import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.unsubscribe',
    noIndex: true,
  });
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
  }>;
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('unsubscribe');

  const { status, type } = await searchParams;

  const typeLabels: Record<string, string> = {
    daily_digest: t('typeDaily'),
    weekly_summary: t('typeWeekly'),
    marketing: t('typeMarketing'),
    all: t('typeAll'),
  };
  const typeLabel = type ? (typeLabels[type] ?? type) : t('genericType');

  if (status === 'success') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('successTitle')}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {t('successDesc', { type: typeLabel })}
          </p>
          <p className="mb-8 text-sm text-muted-foreground">
            {t('manageHint')}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/dashboard/settings/notifications">
                {t('managePreferences')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/">{t('goHome')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-amber-100 p-3">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('invalidTitle')}
          </h1>
          <p className="mb-8 text-muted-foreground">{t('invalidDesc')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline">
              <Link href="/login">{t('loginManage')}</Link>
            </Button>
            <Button asChild>
              <Link href="/">{t('goHome')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('errorTitle')}
          </h1>
          <p className="mb-8 text-muted-foreground">{t('errorDesc')}</p>
          <Button asChild>
            <Link href="/">{t('goHome')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Default: no status, show info page
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
          {t('defaultTitle')}
        </h1>
        <p className="mb-8 text-muted-foreground">{t('defaultDesc')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link href="/login">{t('login')}</Link>
          </Button>
          <Button asChild>
            <Link href="/">{t('goHome')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
