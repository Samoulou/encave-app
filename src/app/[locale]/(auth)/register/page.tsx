import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { generateRegisterMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps) {
  const { locale } = await params;
  return generateRegisterMetadata(locale as Locale);
}

export default function RegisterPage() {
  return <RegisterForm />;
}
