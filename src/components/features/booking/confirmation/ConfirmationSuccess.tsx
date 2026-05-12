import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCheckmark } from './AnimatedCheckmark';

interface ConfirmationSuccessProps {
  visitorEmail: string;
}

export function ConfirmationSuccess({
  visitorEmail,
}: ConfirmationSuccessProps) {
  const t = useTranslations('confirmation');

  return (
    <Card className="hover:translate-y-0 hover:shadow-card">
      <CardContent className="flex flex-col items-center p-8 text-center">
        <div className="mb-6">
          <AnimatedCheckmark size="lg" />
        </div>
        <h1 className="mb-3 font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {t('successTitle')}
        </h1>
        <p className="max-w-lg text-lg font-normal leading-relaxed text-muted-foreground">
          {t('emailSentTo')}{' '}
          <span className="font-semibold text-foreground">{visitorEmail}</span>{' '}
          {t('withAllDetails')}
        </p>
      </CardContent>
    </Card>
  );
}
