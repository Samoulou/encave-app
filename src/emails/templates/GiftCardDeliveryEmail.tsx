import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { t, giftCardDelivery, subjects } from '../translations';

export interface GiftCardDeliveryEmailProps {
  locale: Locale;
  recipientName: string;
  purchaserName: string;
  /** Formatted card value, e.g. "CHF 100.00". */
  amount: string;
  message?: string | null;
  code: string;
  /** Public gift page /bon/[code]. */
  giftUrl: string;
  expiryDate: string;
}

/**
 * Email #7 (P-09 / L-083): sent to the recipient on the chosen delivery
 * date via the GIFT_CARD_DELIVERY scheduled job. The personalised PDF is
 * attached. Locale = the purchase locale.
 */
export function GiftCardDeliveryEmail({
  locale,
  recipientName,
  purchaserName,
  amount,
  message,
  code,
  giftUrl,
  expiryDate,
}: GiftCardDeliveryEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.giftCardDelivery, locale).replace(
        '{purchaserName}',
        purchaserName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(giftCardDelivery.title, locale)}
      </Text>
      <Text>
        {t(giftCardDelivery.intro, locale)
          .replace('{recipientName}', recipientName)
          .replace('{purchaserName}', purchaserName)
          .replace('{amount}', amount)}
      </Text>

      {message ? (
        <Text style={{ fontStyle: 'italic', color: '#4a3b41' }}>
          {t(giftCardDelivery.message, locale).replace('{message}', message)}
        </Text>
      ) : null}

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
        }}
      >
        <Text
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            color: '#9f2448',
            margin: 0,
          }}
        >
          {code}
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={giftUrl}>
          {t(giftCardDelivery.cta, locale)}
        </EmailButton>
      </Section>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(giftCardDelivery.validity, locale).replace(
          '{expiryDate}',
          expiryDate
        )}
      </Text>
    </EmailLayout>
  );
}
