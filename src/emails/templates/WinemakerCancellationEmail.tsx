import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate, formatEmailTime, formatEmailGuests } from '../utils';
import { t, common, winemakerNotification, subjects } from '../translations';

export interface WinemakerCancellationEmailProps {
  locale: Locale;
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  guestCount: number;
  guestName: string;
  bookingRef: string;
  dashboardUrl: string;
}

export function WinemakerCancellationEmail({
  locale,
  winemakerName,
  experienceTitle,
  date,
  guestCount,
  guestName: _guestName,
  bookingRef: _bookingRef,
  dashboardUrl,
}: WinemakerCancellationEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(winemakerNotification.cancellation.title, locale);
  const intro = t(winemakerNotification.cancellation.intro, locale);
  const viewDashboard = t(
    winemakerNotification.newBooking.viewDashboard,
    locale
  );

  const dateLabel = t(common.date, locale);
  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const guestsLabel = t(common.guests, locale);

  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.wineryCancellation, locale)}
    >
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

      <Section
        style={{
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
          borderLeft: '4px solid #dc2626',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280', width: '40%' }}>
                {experienceLabel}
              </td>
              <td style={{ padding: '8px 0', fontWeight: '500' }}>
                {experienceTitle}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {dateLabel}
              </td>
              <td style={{ padding: '8px 0' }}>
                {formatEmailDate(date, locale)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {timeLabel}
              </td>
              <td style={{ padding: '8px 0' }}>
                {formatEmailTime(date, locale)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {guestsLabel}
              </td>
              <td style={{ padding: '8px 0' }}>
                {formatEmailGuests(guestCount, locale)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

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

export default WinemakerCancellationEmail;
