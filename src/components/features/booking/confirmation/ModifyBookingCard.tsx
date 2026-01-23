import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface ModifyBookingCardProps {
  bookingId: string;
}

export function ModifyBookingCard({ bookingId }: ModifyBookingCardProps) {
  const t = useTranslations('confirmation');

  return (
    <Card className="bg-muted/50 border-border hover:translate-y-0 hover:shadow-card">
      <CardContent className="p-6">
        <h4 className="font-bold text-foreground mb-2">{t('needToModify')}</h4>
        <p className="text-sm text-muted-foreground mb-4">
          {t('modifyDescription')}
        </p>
        <Link
          href={`/bookings/${bookingId}/manage`}
          className="text-sm font-bold text-foreground underline hover:text-primary transition-colors"
        >
          {t('manageBooking')}
        </Link>
      </CardContent>
    </Card>
  );
}
