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
      <CardContent className="flex flex-col items-center px-5 py-8 text-center sm:p-8">
        <div className="mb-5 sm:mb-6">
          <AnimatedCheckmark size="lg" />
        </div>
        <h1 className="mb-3 max-w-2xl text-balance font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {t('successTitle')}
        </h1>
        <p className="max-w-xl text-base font-normal leading-relaxed text-muted-foreground sm:text-lg">
          {t('emailSentTo')}{' '}
          <span className="inline-block max-w-full break-all font-semibold text-foreground">
            {visitorEmail}
          </span>{' '}
          {t('withAllDetails')}
        </p>
      </CardContent>
    </Card>
  );
}
