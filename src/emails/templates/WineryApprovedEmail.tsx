import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, common, wineryVerification, subjects } from '../translations';

export interface WineryApprovedEmailProps {
  locale: Locale;
  winemakerName: string;
  wineryName: string;
  dashboardUrl: string;
}

export function WineryApprovedEmail({
  locale,
  winemakerName,
  wineryName,
  dashboardUrl,
}: WineryApprovedEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);
  const questions = t(common.questions, locale);

  const title = t(wineryVerification.approved.title, locale);
  const intro = t(wineryVerification.approved.intro, locale);
  const canNow = t(wineryVerification.approved.canNow, locale);
  const actions = t(wineryVerification.approved.actions, locale);
  const goToDashboard = t(wineryVerification.approved.goToDashboard, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.wineryApproved, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12', margin: '0 0 16px 0' }}>
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {winemakerName},
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        {intro.replace('{wineryName}', wineryName)}
      </Text>

      <Section
        style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Text style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>
          {canNow}
        </Text>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {actions.map((action, index) => (
            <li key={index} style={{ marginBottom: '8px' }}>
              {action}
            </li>
          ))}
        </ul>
      </Section>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={dashboardUrl}>{goToDashboard}</EmailButton>
      </div>

      <Text style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
        {questions}
      </Text>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default WineryApprovedEmail;
