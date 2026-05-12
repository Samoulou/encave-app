import { Text, Section, Hr } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailGuests } from '../utils';
import { t, common, dailyDigest, subjects } from '../translations';

export interface DailyDigestBooking {
  time: string;
  experienceTitle: string;
  guestName: string;
  guestCount: number;
}

export interface DailyDigestEmailProps {
  locale: Locale;
  winemakerName: string;
  wineryName: string;
  todayBookings: DailyDigestBooking[];
  tomorrowBookings: DailyDigestBooking[];
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

export function DailyDigestEmail({
  locale,
  winemakerName,
  wineryName: _wineryName,
  todayBookings,
  tomorrowBookings,
  dashboardUrl,
}: DailyDigestEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(dailyDigest.title, locale);
  const intro = t(dailyDigest.intro, locale);
  const todaySection = t(dailyDigest.today, locale);
  const tomorrowSection = t(dailyDigest.tomorrow, locale);
  const noBookings = t(dailyDigest.noBookings, locale);
  const viewDashboard = t(dailyDigest.viewDashboard, locale);

  const renderBookingsTable = (bookings: DailyDigestBooking[]) => {
    if (bookings.length === 0) {
      return (
        <Text style={{ margin: 0, color: '#6b7280', fontStyle: 'italic' }}>
          {noBookings}
        </Text>
      );
    }

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '600',
              }}
            >
              {t(common.time, locale)}
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '600',
              }}
            >
              {t(common.experience, locale)}
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '600',
              }}
            >
              {t(dailyDigest.guest, locale)}
            </th>
            <th
              style={{
                padding: '8px 4px',
                textAlign: 'right',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '600',
              }}
            >
              {t(common.guests, locale)}
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td
                style={{
                  padding: '12px 4px',
                  fontWeight: 'bold',
                  color: '#7c2d12',
                }}
              >
                {booking.time}
              </td>
              <td style={{ padding: '12px 4px' }}>{booking.experienceTitle}</td>
              <td style={{ padding: '12px 4px' }}>{booking.guestName}</td>
              <td style={{ padding: '12px 4px', textAlign: 'right' }}>
                {formatEmailGuests(booking.guestCount, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <EmailLayout locale={locale} preview={t(subjects.dailyDigest, locale)}>
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

      {/* Today's Bookings */}
      <Section
        style={{
          backgroundColor: '#fef7f0',
          borderRadius: '8px',
          padding: '20px',
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
          {todaySection} ({todayBookings.length})
        </Text>
        {renderBookingsTable(todayBookings)}
      </Section>

      {/* Tomorrow's Bookings */}
      <Section
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '20px',
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
          {tomorrowSection} ({tomorrowBookings.length})
        </Text>
        {renderBookingsTable(tomorrowBookings)}
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

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default DailyDigestEmail;
