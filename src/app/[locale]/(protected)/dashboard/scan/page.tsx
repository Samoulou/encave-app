import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { getScanDayList } from '@/server/queries/scan.queries';
import { ScanClient } from './ScanClient';

interface ScanPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function ScanPage({
  params,
  searchParams,
}: ScanPageProps) {
  const [{ locale }, { sessionId }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  setRequestLocale(locale);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Day mode (no session anchor): preload today's guest list so scanning
  // keeps working offline (P-13 / D2). Session mode stays online-only.
  const dayList = sessionId ? null : await getScanDayList(session.user.id);

  return (
    <ScanClient
      expectedSessionId={sessionId}
      dayList={dayList}
      queueScope={session.user.id}
    />
  );
}
