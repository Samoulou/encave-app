import { getTranslations } from 'next-intl/server';
import { TwoFactorVerifyForm } from '@/components/features/auth/TwoFactorVerifyForm';

interface TwoFactorPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TwoFactorPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.twoFactor' });
  return { title: `${t('title')} | EnCave`, robots: { index: false } };
}

export default function TwoFactorPage() {
  return <TwoFactorVerifyForm />;
}
