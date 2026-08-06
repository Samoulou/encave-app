import { Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, WineItemsTable } from '../components';
import { formatEmailPrice } from '../utils';
import { t, wineOrderRequest, subjects } from '../translations';

export interface WineOrderRequestItemLine {
  wineName: string;
  vintage: number | null;
  quantity: number;
  priceAtRequest: number; // cents
}

function toTableItems(items: WineOrderRequestItemLine[]) {
  return items.map((item) => ({
    name: item.wineName,
    vintage: item.vintage,
    price: item.priceAtRequest,
    quantity: item.quantity,
  }));
}

interface WineOrderRequestWineryEmailProps {
  locale: Locale;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  bookingReference: string;
  items: WineOrderRequestItemLine[];
  totalCents: number;
}

/**
 * Order request to the WINERY (P-07 / US-230): the wines, quantities and
 * the client's contact details. Delivery/payment happen off-platform at
 * launch (Shop 3.1 will take over).
 */
export function WineOrderRequestWineryEmail({
  locale,
  clientName,
  clientEmail,
  clientPhone,
  bookingReference,
  items,
  totalCents,
}: WineOrderRequestWineryEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.wineOrderRequestWinery, locale).replace(
        '{clientName}',
        clientName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(wineOrderRequest.winery.title, locale)}
      </Text>
      <Text>
        {t(wineOrderRequest.winery.intro, locale)
          .replace('{clientName}', clientName)
          .replace('{reference}', bookingReference)}
      </Text>

      <WineItemsTable items={toTableItems(items)} />

      <Text style={{ fontWeight: 600 }}>
        {t(wineOrderRequest.winery.total, locale).replace(
          '{amount}',
          formatEmailPrice(totalCents)
        )}
      </Text>
      <Text>
        {t(wineOrderRequest.winery.contact, locale)
          .replace('{email}', clientEmail)
          .replace('{phone}', clientPhone ? ` · ${clientPhone}` : '')}
      </Text>
      <Text style={{ fontSize: '12px', color: '#6b7280' }}>
        {t(wineOrderRequest.winery.note, locale)}
      </Text>
    </EmailLayout>
  );
}

interface WineOrderRequestClientEmailProps {
  locale: Locale;
  wineryName: string;
  items: WineOrderRequestItemLine[];
  totalCents: number;
}

/** Confirmation copy to the CLIENT (locale = Booking.locale). */
export function WineOrderRequestClientEmail({
  locale,
  wineryName,
  items,
  totalCents,
}: WineOrderRequestClientEmailProps) {
  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.wineOrderRequestClient, locale).replace(
        '{wineryName}',
        wineryName
      )}
    >
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12' }}>
        {t(wineOrderRequest.client.title, locale)}
      </Text>
      <Text>
        {t(wineOrderRequest.client.intro, locale).replace(
          '{wineryName}',
          wineryName
        )}
      </Text>
      <Text style={{ fontWeight: 600, marginBottom: 0 }}>
        {t(wineOrderRequest.client.recap, locale)}
      </Text>
      <WineItemsTable items={toTableItems(items)} />
      <Text style={{ fontWeight: 600 }}>
        {t(wineOrderRequest.winery.total, locale).replace(
          '{amount}',
          formatEmailPrice(totalCents)
        )}
      </Text>
    </EmailLayout>
  );
}
