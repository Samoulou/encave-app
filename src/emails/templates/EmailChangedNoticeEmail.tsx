import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, common, emailChangedNotice, subjects } from '../translations';

interface EmailChangedNoticeEmailProps {
  locale: Locale;
  newEmail: string;
}

/**
 * Security notice to the OLD address after a self-service email change
 * (P-16 / P-14 gap G-2): better-auth only asks the current address for
 * confirmation when it is verified — the instant-change path would
 * otherwise be silent for the previous owner.
 */
export function EmailChangedNoticeEmail({
  locale,
  newEmail,
}: EmailChangedNoticeEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.emailChangedNotice, locale)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(emailChangedNotice.title, locale)}
      </Text>
      <Text>
        {t(emailChangedNotice.intro, locale).replace('{newEmail}', newEmail)}
      </Text>
      <Text style={{ fontWeight: 'bold' }}>
        {t(emailChangedNotice.warning, locale)}
      </Text>
      <Text>{t(common.team, locale)}</Text>
    </EmailLayout>
  );
}
