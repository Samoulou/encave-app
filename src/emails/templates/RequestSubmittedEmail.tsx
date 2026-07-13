import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, request, subjects } from '../translations';

export interface RequestSubmittedEmailProps {
  locale: Locale;
  clientName: string;
  wineryName: string;
  guestCount: number;
  /** Pre-formatted desired date, or null when the client left it open. */
  desiredDate: string | null;
  requestReference: string;
}

/**
 * Email #8 (P-10 / US-240): acknowledgement to the CLIENT right after a
 * sur-mesure request is submitted. Locale = Request.locale. Premium but
 * relaxed tone, no mandatory CTA.
 */
export function RequestSubmittedEmail({
  locale,
  clientName,
  wineryName,
  guestCount,
  desiredDate,
  requestReference,
}: RequestSubmittedEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.requestSubmitted, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(request.submitted.title, locale)}
      </Text>
      <Text>
        {t(request.submitted.intro, locale)
          .replace('{clientName}', clientName)
          .replace('{wineryName}', wineryName)}
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
          {t(request.submitted.recapTitle, locale)}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.submitted.guests, locale).replace(
            '{count}',
            String(guestCount)
          )}
        </Text>
        {desiredDate ? (
          <Text style={{ margin: '0 0 4px 0' }}>
            {t(request.submitted.desiredDate, locale).replace(
              '{date}',
              desiredDate
            )}
          </Text>
        ) : null}
        <Text style={{ margin: 0 }}>
          {t(request.submitted.reference, locale).replace(
            '{reference}',
            requestReference
          )}
        </Text>
      </Section>

      <Text style={{ color: '#6b7280' }}>
        {t(request.submitted.signoff, locale)}
      </Text>
    </EmailLayout>
  );
}
