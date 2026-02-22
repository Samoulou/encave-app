import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCheckmark } from './AnimatedCheckmark';

interface ConfirmationSuccessProps {
  visitorEmail: string;
}

export function ConfirmationSuccess({ visitorEmail }: ConfirmationSuccessProps) {
  const t = useTranslations('confirmation');

  return (
    <Card className="hover:translate-y-0 hover:shadow-card">
      <CardContent className="p-8 text-center flex flex-col items-center">
        <div className="mb-6">
          <AnimatedCheckmark size="lg" />
        </div>
        <h1 className="font-display text-foreground tracking-tight text-3xl md:text-4xl font-bold leading-tight mb-3">
          {t('successTitle')}
        </h1>
        <p className="text-muted-foreground text-lg font-normal leading-relaxed max-w-lg">
          {t('emailSentTo')}{' '}
          <span className="font-semibold text-foreground">{visitorEmail}</span>{' '}
          {t('withAllDetails')}
        </p>
      </CardContent>
    </Card>
  );
}
