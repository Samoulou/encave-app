import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, contact, subjects } from '../translations';

export interface ContactMessageEmailProps {
  locale: Locale;
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Contact form → team notification (P-12 / L-114). Internal recipient
 * (samuel@encave.ch); the sender's address is set as reply-to so the team
 * can answer directly.
 */
export function ContactMessageEmail({
  locale,
  name,
  email,
  subject,
  message,
}: ContactMessageEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.contactMessage, locale).replace('{name}', name)}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(contact.notify.title, locale)}
      </Text>
      <Text>
        {t(contact.notify.from, locale)
          .replace('{name}', name)
          .replace('{email}', email)}
      </Text>
      <Text>
        {t(contact.notify.subjectLine, locale).replace('{subject}', subject)}
      </Text>

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
        }}
      >
        <Text style={{ fontWeight: 600, margin: '0 0 8px 0' }}>
          {t(contact.notify.messageTitle, locale)}
        </Text>
        <Text style={{ margin: 0, whiteSpace: 'pre-line' }}>{message}</Text>
      </Section>
    </EmailLayout>
  );
}
