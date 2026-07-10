import { Section, Text } from '@react-email/components';
import { formatEmailPrice } from '../utils';

export interface WineItemLine {
  name: string;
  vintage: number | null;
  /** Cents. Multiplied by quantity when one is given. */
  price: number;
  /** Shown as a "N ×" prefix and multiplies the price (order emails). */
  quantity?: number;
  /** Second line under the name (recap email shows the grape variety). */
  subtitle?: string;
}

/**
 * The bordered wine-line table shared by every tasting-loop email
 * (J+2 recap, order request to the winery, client copy) — one place for
 * the row styling and the name/vintage/price formatting.
 */
export function WineItemsTable({ items }: { items: WineItemLine[] }) {
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
          key={`${item.name}-${index}`}
          width="100%"
          style={{
            borderBottom:
              index < items.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <tr>
            <td style={{ padding: '10px 0' }}>
              <Text style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                {item.quantity !== undefined ? `${item.quantity} × ` : ''}
                {item.name}
                {item.vintage != null ? ` ${item.vintage}` : ''}
              </Text>
              {item.subtitle !== undefined && (
                <Text style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                  {item.subtitle}
                </Text>
              )}
            </td>
            <td
              align="right"
              style={{ verticalAlign: 'top', padding: '10px 0' }}
            >
              <Text style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                {formatEmailPrice(item.price * (item.quantity ?? 1))}
              </Text>
            </td>
          </tr>
        </table>
      ))}
    </Section>
  );
}
