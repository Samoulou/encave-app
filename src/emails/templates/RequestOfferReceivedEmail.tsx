import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, request, subjects } from '../translations';

export interface RequestOfferReceivedEmailProps {
  locale: Locale;
  clientName: string;
  wineryName: string;
  message: string;
  /** Pre-formatted total price, all included (e.g. "CHF 450.00"). */
  total: string;
  /** Pre-formatted event date. */
  eventDate: string;
  /** Event start time, "HH:mm". */
  eventTime: string;
  guestCount: number;
  /** Pre-formatted validity deadline. */
  expiry: string;
  payUrl: string;
}

/**
 * Email #9 (P-10 / US-240): the winery's offer, ready for the CLIENT to
 * pay. Locale = Request.locale. Primary CTA « Payer maintenant » → payUrl.
 */
export function RequestOfferReceivedEmail({
  locale,
  clientName,
  wineryName,
  message,
  total,
  eventDate,
  eventTime,
  guestCount,
  expiry,
  payUrl,
}: RequestOfferReceivedEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.requestOfferReceived, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(request.offerReceived.title, locale).replace(
          '{wineryName}',
          wineryName
        )}
      </Text>
      <Text>
        {t(request.offerReceived.intro, locale)
          .replace('{clientName}', clientName)
          .replace('{wineryName}', wineryName)}
      </Text>

      <Text style={{ fontWeight: 600, margin: '0 0 4px 0' }}>
        {t(request.offerReceived.messageLabel, locale)}
      </Text>
      <Text
        style={{
          fontStyle: 'italic',
          color: '#4a3b41',
          borderLeft: '3px solid #e5e7eb',
          paddingLeft: '12px',
        }}
      >
        {message}
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
          {t(request.offerReceived.schedule, locale)
            .replace('{date}', eventDate)
            .replace('{time}', eventTime)}
        </Text>
        <Text style={{ margin: '0 0 4px 0' }}>
          {t(request.offerReceived.guests, locale).replace(
            '{count}',
            String(guestCount)
          )}
        </Text>
        <Text style={{ fontWeight: 600, margin: 0 }}>
          {t(request.offerReceived.total, locale).replace('{amount}', total)}
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={payUrl}>
          {t(request.offerReceived.cta, locale)}
        </EmailButton>
      </Section>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(request.offerReceived.expiry, locale).replace('{date}', expiry)}
      </Text>
    </EmailLayout>
  );
}
