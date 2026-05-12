import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface ModifyBookingCardProps {
  bookingId: string;
}

export function ModifyBookingCard({ bookingId }: ModifyBookingCardProps) {
  const t = useTranslations('confirmation');

  return (
    <Card className="border-border bg-muted/50 hover:translate-y-0 hover:shadow-card">
      <CardContent className="p-6">
        <h4 className="mb-2 font-bold text-foreground">{t('needToModify')}</h4>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('modifyDescription')}
        </p>
        <Link
          href={`/bookings/${bookingId}/manage`}
          className="text-sm font-bold text-foreground underline transition-colors hover:text-primary"
        >
          {t('manageBooking')}
        </Link>
      </CardContent>
    </Card>
  );
}
