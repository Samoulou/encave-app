import { LoginForm } from '@/components/features/auth/LoginForm';
import { generateLoginMetadata } from '@/lib/seo';
import type { Locale } from '@/i18n/routing';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LoginPageProps) {
  const { locale } = await params;
  return generateLoginMetadata(locale as Locale);
}

export default function LoginPage() {
  return <LoginForm />;
}
