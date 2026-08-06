import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailDate } from '../utils';
import { t, common, accountDeleted, subjects } from '../translations';

interface AccountDeletedEmailProps {
  locale: Locale;
  date: Date;
}

export function AccountDeletedEmail({
  locale,
  date,
}: AccountDeletedEmailProps) {
  return (
    <EmailLayout locale={locale} preview={t(subjects.accountDeleted, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(accountDeleted.title, locale)}
      </Text>
      <Text>
        {t(accountDeleted.intro, locale).replace(
          '{date}',
          formatEmailDate(date, locale)
        )}
      </Text>
      <Text>{t(accountDeleted.retention, locale)}</Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
