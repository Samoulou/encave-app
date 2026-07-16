import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, adminNewWinery, subjects } from '../translations';

export interface AdminNewWineryToValidateEmailProps {
  locale: Locale;
  wineryName: string;
  commune: string;
  contactEmail: string;
  reviewUrl: string;
}

export function AdminNewWineryToValidateEmail({
  locale,
  wineryName,
  commune,
  contactEmail,
  reviewUrl,
}: AdminNewWineryToValidateEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.adminNewWinery, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#7c2d12',
          margin: '0 0 16px 0',
        }}
      >
        {t(adminNewWinery.title, locale)}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {t(adminNewWinery.intro, locale)}
      </Text>

      <Section
        style={{
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
          padding: '20px',
          margin: '0 0 24px 0',
        }}
      >
        <Text style={{ margin: '0 0 8px 0' }}>
          <strong>{t(adminNewWinery.nameLabel, locale)} :</strong> {wineryName}
        </Text>
        <Text style={{ margin: '0 0 8px 0' }}>
          <strong>{t(adminNewWinery.communeLabel, locale)} :</strong> {commune}
        </Text>
        <Text style={{ margin: 0 }}>
          <strong>{t(adminNewWinery.contactLabel, locale)} :</strong>{' '}
          {contactEmail}
        </Text>
      </Section>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={reviewUrl}>
          {t(adminNewWinery.cta, locale)}
        </EmailButton>
      </div>
    </EmailLayout>
  );
}

export default AdminNewWineryToValidateEmail;
