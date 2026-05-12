import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, common, auth, subjects } from '../translations';

export interface EmailVerificationEmailProps {
  locale: Locale;
  userName: string;
  verificationUrl: string;
}

export function EmailVerificationEmail({
  locale,
  userName,
  verificationUrl,
}: EmailVerificationEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(auth.verification.title, locale);
  const intro = t(auth.verification.intro, locale);
  const button = t(auth.verification.button, locale);
  const expiry = t(auth.verification.expiry, locale);

  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.emailVerification, locale)}
    >
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
        {greeting} {userName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={verificationUrl}>{button}</EmailButton>
      </div>

      <Text
        style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}
      >
        {expiry}
      </Text>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default EmailVerificationEmail;
