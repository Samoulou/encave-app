import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate, formatEmailPrice } from '../utils';
import { t, common, bookingCancelledByWinery, subjects } from '../translations';

interface BookingCancelledByWineryEmailProps {
  locale: Locale;
  guestName: string;
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  amountCents: number;
  reason: string;
  experiencesUrl: string;
}

export function BookingCancelledByWineryEmail({
  locale,
  guestName,
  winemakerName,
  experienceTitle,
  date,
  amountCents,
  reason,
  experiencesUrl,
}: BookingCancelledByWineryEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.bookingCancelledByWinery, locale).replace(
        '{winemakerName}',
        winemakerName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(bookingCancelledByWinery.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {guestName},
      </Text>
      <Text>
        {t(bookingCancelledByWinery.intro, locale)
          .replace('{winemakerName}', winemakerName)
          .replace('{experienceTitle}', experienceTitle)
          .replace('{date}', formatEmailDate(date, locale))}
      </Text>
      <Text>
        {t(bookingCancelledByWinery.reason, locale).replace('{reason}', reason)}
      </Text>
      <Text>
        {t(bookingCancelledByWinery.refund, locale).replace(
          '{amount}',
          formatEmailPrice(amountCents)
        )}
      </Text>
      <EmailButton href={experiencesUrl}>
        {t(bookingCancelledByWinery.browseMore, locale)}
      </EmailButton>
      <Text>{t(bookingCancelledByWinery.apology, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
