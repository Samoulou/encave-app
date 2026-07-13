import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { t, giftCardPurchase, subjects } from '../translations';

export interface GiftCardPurchaseEmailProps {
  locale: Locale;
  purchaserName: string;
  recipientName: string;
  /** Formatted card value, e.g. "CHF 100.00". */
  amount: string;
  code: string;
  /** Formatted delivery date shown to the purchaser. */
  deliverDate: string;
  expiryDate: string;
}

/**
 * Email #6 (P-09 / L-083): sent to the purchaser immediately after a
 * successful gift-card payment. The personalised PDF is attached. Locale
 * = the purchase locale.
 */
export function GiftCardPurchaseEmail({
  locale,
  purchaserName,
  recipientName,
  amount,
  code,
  deliverDate,
  expiryDate,
}: GiftCardPurchaseEmailProps) {
  return (
    <EmailLayout locale={locale} preview={t(subjects.giftCardPurchase, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(giftCardPurchase.title, locale)}
      </Text>
      <Text>
        {t(giftCardPurchase.intro, locale)
          .replace('{purchaserName}', purchaserName)
          .replace('{amount}', amount)}
      </Text>

      <Section
        style={{
          margin: '20px 0',
          padding: '16px',
          backgroundColor: '#faf6f7',
          borderRadius: '8px',
        }}
      >
        <Text style={{ fontSize: '12px', color: '#915564', margin: '0 0 4px' }}>
          {t(giftCardPurchase.codeLabel, locale)}
        </Text>
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

      <Text>
        {t(giftCardPurchase.scheduled, locale)
          .replace('{recipientName}', recipientName)
          .replace('{deliverDate}', deliverDate)}
      </Text>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(giftCardPurchase.validity, locale).replace(
          '{expiryDate}',
          expiryDate
        )}
      </Text>
    </EmailLayout>
  );
}
