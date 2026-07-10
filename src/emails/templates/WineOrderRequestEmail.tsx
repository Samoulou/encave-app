import { Section, Text } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout } from '../components';
import { formatEmailPrice } from '../utils';
import { t, wineOrderRequest, subjects } from '../translations';

export interface WineOrderRequestItemLine {
  wineName: string;
  vintage: number | null;
  quantity: number;
  priceAtRequest: number; // cents
}

function ItemsTable({ items }: { items: WineOrderRequestItemLine[] }) {
  return (
    <Section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '8px 16px',
        margin: '16px 0',
      }}
    >
      {items.map((item, index) => (
        <table
          key={`${item.wineName}-${index}`}
          width="100%"
          style={{
            borderBottom:
              index < items.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <tr>
            <td style={{ padding: '10px 0' }}>
              <Text style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                {item.quantity} × {item.wineName}
                {item.vintage != null ? ` ${item.vintage}` : ''}
              </Text>
            </td>
            <td
              align="right"
              style={{ verticalAlign: 'top', padding: '10px 0' }}
            >
              <Text style={{ margin: 0, fontSize: '14px' }}>
                {formatEmailPrice(item.priceAtRequest * item.quantity)}
              </Text>
            </td>
          </tr>
        </table>
      ))}
    </Section>
  );
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

      <ItemsTable items={items} />

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
      <ItemsTable items={items} />
      <Text style={{ fontWeight: 600 }}>
        {t(wineOrderRequest.winery.total, locale).replace(
          '{amount}',
          formatEmailPrice(totalCents)
        )}
      </Text>
    </EmailLayout>
  );
}
