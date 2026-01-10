import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, common, auth, subjects } from '../translations';

export interface WelcomeEmailProps {
  locale: Locale;
  userName: string;
  experiencesUrl: string;
}

export function WelcomeEmail({
  locale,
  userName,
  experiencesUrl,
}: WelcomeEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(auth.welcome.title, locale);
  const intro = t(auth.welcome.intro, locale);
  const discover = t(auth.welcome.discover, locale);
  const explore = t(auth.welcome.explore, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.welcome, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12', margin: '0 0 16px 0' }}>
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {userName},
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        {intro}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {discover}
      </Text>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={experiencesUrl}>{explore}</EmailButton>
      </div>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;
