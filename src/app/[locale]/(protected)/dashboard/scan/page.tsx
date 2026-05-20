import { setRequestLocale } from 'next-intl/server';
import { ScanClient } from './ScanClient';

interface ScanPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function ScanPage({
  params,
  searchParams,
}: ScanPageProps) {
  const { locale } = await params;
  const { sessionId } = await searchParams;
  setRequestLocale(locale);

  return <ScanClient expectedSessionId={sessionId} />;
}
