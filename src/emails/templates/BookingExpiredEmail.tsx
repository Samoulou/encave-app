import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate } from '../utils';
import { t, common, bookingExpired, subjects } from '../translations';

interface BookingExpiredEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  date: Date;
  experienceUrl: string;
}

export function BookingExpiredEmail({
  locale,
  guestName,
  experienceTitle,
  date,
  experienceUrl,
}: BookingExpiredEmailProps) {
  return (
    <EmailLayout locale={locale} preview={t(subjects.bookingExpired, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(bookingExpired.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {guestName},
      </Text>
      <Text>
        {t(bookingExpired.intro, locale)
          .replace('{experienceTitle}', experienceTitle)
          .replace('{date}', formatEmailDate(date, locale))}
      </Text>
      <EmailButton href={experienceUrl}>
        {t(bookingExpired.cta, locale)}
      </EmailButton>
      <Text>{t(bookingExpired.signoff, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
