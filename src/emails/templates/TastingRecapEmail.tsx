import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton, WineItemsTable } from '../components';
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

      <WineItemsTable
        items={wines.map((wine) => ({
          name: wine.name,
          vintage: wine.vintage,
          price: wine.price,
          subtitle: wine.grapeVariety,
        }))}
      />

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <EmailButton href={orderUrl}>{t(tastingRecap.cta, locale)}</EmailButton>
      </Section>

      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(tastingRecap.note, locale).replace('{wineryName}', wineryName)}
      </Text>
    </EmailLayout>
  );
}
