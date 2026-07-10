import { QrCode } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/**
 * Floating scan entry point (L-130) — day mode: /dashboard/scan without
 * a sessionId scans against the whole day's preloaded list (P-13 A5).
 * Mobile-only; the desktop header carries a regular button.
 */
export async function ScanFab() {
  const t = await getTranslations('Dashboard.today');

  return (
    <Link
      href="/dashboard/scan"
      aria-label={t('scanButton')}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-warm-xl transition-transform active:scale-95 md:hidden"
    >
      <QrCode className="h-6 w-6" aria-hidden="true" />
    </Link>
  );
}
