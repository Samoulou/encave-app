import { Text, Section, Hr } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailPrice } from '../utils';
import { t, common, weeklySummary, subjects } from '../translations';

export interface WeeklySummaryStats {
  bookings: number;
  guests: number;
  revenue: number; // in cents
}

export interface WeeklySummaryEmailProps {
  locale: Locale;
  winemakerName: string;
  wineryName: string;
  lastWeekStats: WeeklySummaryStats;
  thisWeekPreview: {
    bookings: number;
    guests: number;
  };
  /** Real Stripe payouts received last 7 days (P-13 / email #17). */
  payouts?: { totalCents: number; count: number } | null;
  /** Previous-month statement PDF link (P-13 / email #17). */
  statement?: { url: string; monthLabel: string } | null;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

export function WeeklySummaryEmail({
  locale,
  winemakerName,
  wineryName: _wineryName,
  lastWeekStats,
  thisWeekPreview,
  payouts,
  statement,
  dashboardUrl,
}: WeeklySummaryEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(weeklySummary.title, locale);
  const intro = t(weeklySummary.intro, locale);
  const lastWeekSection = t(weeklySummary.lastWeek, locale);
  const thisWeekSection = t(weeklySummary.thisWeek, locale);
  const bookingsLabel = t(weeklySummary.bookings, locale);
  const guestsLabel = t(weeklySummary.guests, locale);
  const revenueLabel = t(weeklySummary.revenue, locale);
  const upcomingLabel = t(weeklySummary.upcoming, locale);
  const viewDashboard = t(weeklySummary.viewDashboard, locale);
  const noActivity = t(weeklySummary.noActivity, locale);

  const payoutsReceivedLabel = t(weeklySummary.payoutsReceived, locale);
  const payoutsLine =
    payouts && payouts.count > 0
      ? t(weeklySummary.payoutsLine, locale)
          .replace('{amount}', formatEmailPrice(payouts.totalCents))
          .replace('{count}', String(payouts.count))
      : null;
  const statementLabel = statement
    ? t(weeklySummary.downloadStatement, locale).replace(
        '{month}',
        statement.monthLabel
      )
    : null;

  const hasLastWeekActivity = lastWeekStats.bookings > 0;
  const hasThisWeekActivity = thisWeekPreview.bookings > 0;

  return (
    <EmailLayout locale={locale} preview={t(subjects.weeklySummary, locale)}>
      <Text
        style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#7c2d12',
          margin: '0 0 16px 0',
        }}
      >
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {winemakerName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      {/* Last Week Stats */}
      <Section
        style={{
          backgroundColor: '#fef7f0',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 16px 0',
        }}
      >
        <Text
          style={{
            margin: '0 0 16px 0',
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#7c2d12',
          }}
        >
          {lastWeekSection}
        </Text>

        {hasLastWeekActivity ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #fde8d4',
                  }}
                >
                  <Text
                    style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}
                  >
                    {bookingsLabel}
                  </Text>
                </td>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #fde8d4',
                    textAlign: 'right',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      color: '#7c2d12',
                    }}
                  >
                    {lastWeekStats.bookings}
                  </Text>
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #fde8d4',
                  }}
                >
                  <Text
                    style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}
                  >
                    {guestsLabel}
                  </Text>
                </td>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #fde8d4',
                    textAlign: 'right',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      color: '#7c2d12',
                    }}
                  >
                    {lastWeekStats.guests}
                  </Text>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0' }}>
                  <Text
                    style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}
                  >
                    {revenueLabel}
                  </Text>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right' }}>
                  <Text
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      color: '#16a34a',
                    }}
                  >
                    {formatEmailPrice(lastWeekStats.revenue)}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Text style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
            {noActivity}
          </Text>
        )}
      </Section>

      {/* Real Stripe payouts of the week (P-13 / email #17) */}
      {payoutsLine && (
        <Section
          style={{
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            padding: '24px',
            margin: '0 0 16px 0',
          }}
        >
          <Text
            style={{
              margin: '0 0 8px 0',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#166534',
            }}
          >
            {payoutsReceivedLabel}
          </Text>
          <Text
            style={{
              margin: 0,
              fontWeight: 'bold',
              fontSize: '20px',
              color: '#16a34a',
            }}
          >
            {payoutsLine}
          </Text>
        </Section>
      )}

      {/* This Week Preview */}
      <Section
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
        }}
      >
        <Text
          style={{
            margin: '0 0 16px 0',
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#374151',
          }}
        >
          {thisWeekSection}
        </Text>

        {hasThisWeekActivity ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <Text
                    style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}
                  >
                    {upcomingLabel}
                  </Text>
                </td>
                <td
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #e5e7eb',
                    textAlign: 'right',
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      color: '#374151',
                    }}
                  >
                    {thisWeekPreview.bookings}
                  </Text>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '12px 0' }}>
                  <Text
                    style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}
                  >
                    {guestsLabel}
                  </Text>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right' }}>
                  <Text
                    style={{
                      margin: 0,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      color: '#374151',
                    }}
                  >
                    {thisWeekPreview.guests}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <Text style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
            {noActivity}
          </Text>
        )}
      </Section>

      <Hr
        style={{
          border: 'none',
          borderTop: '1px solid #e5e7eb',
          margin: '24px 0',
        }}
      />

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={dashboardUrl}>{viewDashboard}</EmailButton>
      </div>

      {statement && statementLabel && (
        <Text style={{ margin: '0 0 24px 0', textAlign: 'center' }}>
          <a
            href={statement.url}
            style={{ color: '#7c2d12', textDecoration: 'underline' }}
          >
            {statementLabel}
          </a>
        </Text>
      )}

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default WeeklySummaryEmail;
