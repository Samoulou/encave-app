import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailPrice } from '../utils';
import { t, tastingRecap, subjects } from '../translations';

export interface TastingRecapWine {
  name: string;
  grapeVariety: string;
  vintage: number | null;
  price: number; // cents
}

interface TastingRecapEmailProps {
  locale: Locale;
  guestName: string;
  wineryName: string;
  wines: TastingRecapWine[];
  /** Tokenized wine-order page (D3 — never a mutating GET). */
  orderUrl: string;
  /** Tokenized client opt-out link (LCD compliance). */
  unsubscribeUrl: string;
}

/**
 * Email #3 « Vos coups de cœur » (P-07 / US-230), sent J+2 after the
 * session once the tasting sheet is filled. Locale = Booking.locale.
 */
export function TastingRecapEmail({
  locale,
  guestName,
  wineryName,
  wines,
  orderUrl,
  unsubscribeUrl,
}: TastingRecapEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.tastingRecap, locale).replace(
        '{wineryName}',
        wineryName
      )}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(tastingRecap.title, locale).replace('{wineryName}', wineryName)}
      </Text>
      <Text>
        {t(tastingRecap.intro, locale).replace('{guestName}', guestName)}
      </Text>

      <Section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px 16px',
          margin: '16px 0',
        }}
      >
        {wines.map((wine, index) => (
          <table
            key={`${wine.name}-${index}`}
            width="100%"
            style={{
              borderBottom:
                index < wines.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}
          >
            <tr>
              <td style={{ padding: '10px 0' }}>
                <Text style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                  {wine.name}
                  {wine.vintage != null ? ` ${wine.vintage}` : ''}
                </Text>
                <Text style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                  {wine.grapeVariety}
                </Text>
              </td>
              <td
                align="right"
                style={{ verticalAlign: 'top', padding: '10px 0' }}
              >
                <Text style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                  {formatEmailPrice(wine.price)}
                </Text>
              </td>
            </tr>
          </table>
        ))}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={orderUrl}>{t(tastingRecap.cta, locale)}</EmailButton>
      </Section>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(tastingRecap.note, locale).replace('{wineryName}', wineryName)}
      </Text>
    </EmailLayout>
  );
}
