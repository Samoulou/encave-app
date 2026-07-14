import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, contact, subjects } from '../translations';

export interface ContactAckEmailProps {
  locale: Locale;
  name: string;
  message: string;
}

/**
 * Contact form → client acknowledgement (P-12 / L-114). Locale = the form
 * locale. Premium but relaxed tone, echoes the message back for the record.
 */
export function ContactAckEmail({
  locale,
  name,
  message,
}: ContactAckEmailProps) {
  return (
    <EmailLayout locale={locale} preview={t(subjects.contactAck, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(contact.ack.title, locale)}
      </Text>
      <Text>{t(contact.ack.intro, locale).replace('{name}', name)}</Text>

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
        }}
      >
        <Text style={{ fontWeight: 600, margin: '0 0 8px 0' }}>
          {t(contact.ack.recapTitle, locale)}
        </Text>
        <Text style={{ margin: 0, whiteSpace: 'pre-line' }}>{message}</Text>
      </Section>

      <Text style={{ color: '#6b7280' }}>{t(contact.ack.signoff, locale)}</Text>
    </EmailLayout>
  );
}
