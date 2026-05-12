import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, common, wineryVerification, subjects } from '../translations';

export interface WineryRejectedEmailProps {
  locale: Locale;
  winemakerName: string;
  wineryName: string;
  reason: string;
}

export function WineryRejectedEmail({
  locale,
  winemakerName,
  wineryName,
  reason,
}: WineryRejectedEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(wineryVerification.rejected.title, locale);
  const intro = t(wineryVerification.rejected.intro, locale);
  const reasonLabel = t(wineryVerification.rejected.reason, locale);
  const appeal = t(wineryVerification.rejected.appeal, locale);
  const resubmit = t(wineryVerification.rejected.resubmit, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.wineryRejected, locale)}>
      <Text
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#7c2d12',
          margin: '0 0 16px 0',
        }}
      >
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {winemakerName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {intro.replace('{wineryName}', wineryName)}
      </Text>

      <Section
        style={{
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
          borderLeft: '4px solid #dc2626',
        }}
      >
        <Text
          style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#991b1b' }}
        >
          {reasonLabel}:
        </Text>
        <Text style={{ margin: 0, color: '#7f1d1d' }}>{reason}</Text>
      </Section>

      <Text style={{ margin: '0 0 16px 0' }}>{appeal}</Text>

      <Text style={{ margin: '0 0 24px 0' }}>{resubmit}</Text>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default WineryRejectedEmail;
