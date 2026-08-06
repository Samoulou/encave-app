import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, request, subjects } from '../translations';

export interface RequestOfferExpiringEmailProps {
  locale: Locale;
  clientName: string;
  wineryName: string;
  /** Pre-formatted amount to pay. */
  total: string;
  /** Pre-formatted expiry deadline. */
  expiry: string;
  payUrl: string;
}

/**
 * Email #10 (P-10 / US-240): the SINGLE reminder before a sur-mesure
 * offer expires. Locale = Request.locale. CTA « Payer » → payUrl.
 */
export function RequestOfferExpiringEmail({
  locale,
  clientName,
  wineryName,
  total,
  expiry,
  payUrl,
}: RequestOfferExpiringEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.requestOfferExpiring, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(request.offerExpiring.title, locale)}
      </Text>
      <Text>
        {t(request.offerExpiring.intro, locale)
          .replace('{clientName}', clientName)
          .replace('{wineryName}', wineryName)
          .replace('{date}', expiry)}
      </Text>

      <Text style={{ fontWeight: 600 }}>
        {t(request.offerExpiring.total, locale).replace('{amount}', total)}
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={payUrl}>
          {t(request.offerExpiring.cta, locale)}
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}
