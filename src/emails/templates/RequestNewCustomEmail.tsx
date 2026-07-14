import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, request, common, subjects } from '../translations';

export interface RequestNewCustomEmailProps {
  locale: Locale;
  winemakerName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  guestCount: number;
  /** Pre-formatted desired date, or null when left open. */
  desiredDate: string | null;
  /** Pre-formatted indicative budget, or null when not provided. */
  budget: string | null;
  description: string;
  requestReference: string;
  inboxUrl: string;
}

/**
 * Email #15 (P-10 / US-240): a new sur-mesure request landing at the
 * WINERY. Locale = winemaker preferredLocale. Reminds the 48h SLA and
 * links straight to the request inbox.
 */
export function RequestNewCustomEmail({
  locale,
  winemakerName,
  clientName,
  clientEmail,
  clientPhone,
  guestCount,
  desiredDate,
  budget,
  description,
  requestReference,
  inboxUrl,
}: RequestNewCustomEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.requestNewCustom, locale).replace(
        '{clientName}',
        clientName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(request.newCustom.title, locale)}
      </Text>
      <Text>
        {t(common.greeting, locale)} {winemakerName},
      </Text>
      <Text>
        {t(request.newCustom.intro, locale)
          .replace('{clientName}', clientName)
          .replace('{reference}', requestReference)}
      </Text>

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
        }}
      >
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.newCustom.contact, locale)
            .replace('{email}', clientEmail)
            .replace('{phone}', clientPhone ? ` · ${clientPhone}` : '')}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.newCustom.guests, locale).replace(
            '{count}',
            String(guestCount)
          )}
        </Text>
        {desiredDate ? (
          <Text style={{ margin: '0 0 4px 0' }}>
            {t(request.newCustom.desiredDate, locale).replace(
              '{date}',
              desiredDate
            )}
          </Text>
        ) : null}
        {budget ? (
          <Text style={{ margin: 0 }}>
            {t(request.newCustom.budget, locale).replace('{amount}', budget)}
          </Text>
        ) : null}
      </Section>

      <Text style={{ fontWeight: 600, margin: '0 0 4px 0' }}>
        {t(request.newCustom.descriptionLabel, locale)}
      </Text>
      <Text
        style={{
          fontStyle: 'italic',
          color: '#4a3b41',
          borderLeft: '3px solid #e5e7eb',
          paddingLeft: '12px',
        }}
      >
        {description}
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={inboxUrl}>
          {t(request.newCustom.cta, locale)}
        </EmailButton>
      </Section>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(request.newCustom.sla, locale)}
      </Text>
    </EmailLayout>
  );
}
