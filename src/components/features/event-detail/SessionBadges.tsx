import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';

interface SessionBadgesProps {
  isLive: boolean;
  isFull: boolean;
}

export async function SessionBadges({ isLive, isFull }: SessionBadgesProps) {
  const t = await getTranslations('Dashboard.eventDetail.session');

  if (!isLive && !isFull) return null;

  return (
    <div className="flex items-center gap-2">
      {isLive ? (
        <Badge
          variant="default"
          className="border-transparent bg-emerald-600 text-white"
        >
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white"
            aria-hidden="true"
          />
          {t('live')}
        </Badge>
      ) : null}
      {isFull ? <Badge variant="secondary">{t('fullBadge')}</Badge> : null}
    </div>
  );
}
