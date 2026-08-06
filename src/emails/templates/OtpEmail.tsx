import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, common, auth, subjects } from '../translations';

export type OtpPurpose = 'sign-in' | 'forget-password' | 'email-verification';

export interface OtpEmailProps {
  locale: Locale;
  otp: string;
  purpose: OtpPurpose;
}

function introFor(purpose: OtpPurpose, locale: Locale): string {
  switch (purpose) {
    case 'forget-password':
      return t(auth.otp.introForgetPassword, locale);
    case 'email-verification':
      return t(auth.otp.introEmailVerification, locale);
    default:
      return t(auth.otp.introSignIn, locale);
  }
}

export function OtpEmail({ locale, otp, purpose }: OtpEmailProps) {
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(auth.otp.title, locale);
  const intro = introFor(purpose, locale);
  const expiry = t(auth.otp.expiry, locale);
  const ignore = t(auth.otp.ignore, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.otpCode, locale)}>
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

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <Text
          style={{
            display: 'inline-block',
            fontSize: '34px',
            fontWeight: 'bold',
            letterSpacing: '8px',
            color: '#7c2d12',
            background: '#f5f0eb',
            borderRadius: '10px',
            padding: '16px 24px',
            margin: '0',
          }}
        >
          {otp}
        </Text>
      </div>

      <Text
        style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}
      >
        {expiry}
      </Text>

      <Text
        style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}
      >
        {ignore}
      </Text>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default OtpEmail;
