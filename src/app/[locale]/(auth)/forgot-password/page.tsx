import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ForgotPasswordPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' });
  return { title: `${t('title')} | EnCave`, robots: { index: false } };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
