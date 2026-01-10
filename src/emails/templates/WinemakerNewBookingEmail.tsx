import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import {
  formatEmailDate,
  formatEmailTime,
  formatEmailGuests,
  formatEmailPrice,
} from '../utils';
import { t, common, winemakerNotification, subjects } from '../translations';

export interface WinemakerNewBookingEmailProps {
  locale: Locale;
  winemakerName: string;
  experienceTitle: string;
  date: Date;
  guestCount: number;
  totalPrice: number; // in cents
  guestName: string;
  guestEmail: string;
  bookingRef: string;
  dashboardUrl: string;
}

export function WinemakerNewBookingEmail({
  locale,
  winemakerName,
  experienceTitle,
  date,
  guestCount,
  totalPrice,
  guestName,
  guestEmail,
  bookingRef: _bookingRef,
  dashboardUrl,
}: WinemakerNewBookingEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(winemakerNotification.newBooking.title, locale);
  const intro = t(winemakerNotification.newBooking.intro, locale);
  const guestInfo = t(winemakerNotification.newBooking.guestInfo, locale);
  const guestNameLabel = t(winemakerNotification.newBooking.guestName, locale);
  const guestEmailLabel = t(winemakerNotification.newBooking.guestEmail, locale);
  const viewDashboard = t(winemakerNotification.newBooking.viewDashboard, locale);

  const dateLabel = t(common.date, locale);
  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const guestsLabel = t(common.guests, locale);
  const priceLabel = t(common.price, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.wineryNewBooking, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12', margin: '0 0 16px 0' }}>
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {winemakerName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {intro}
      </Text>

      <Section
        style={{
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
          borderLeft: '4px solid #22c55e',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280', width: '40%' }}>{experienceLabel}</td>
              <td style={{ padding: '8px 0', fontWeight: '500' }}>{experienceTitle}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{dateLabel}</td>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{formatEmailDate(date, locale)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{timeLabel}</td>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{formatEmailTime(date, locale)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{guestsLabel}</td>
              <td style={{ padding: '8px 0' }}>{formatEmailGuests(guestCount, locale)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{priceLabel}</td>
              <td style={{ padding: '8px 0', fontWeight: 'bold', color: '#22c55e' }}>
                {formatEmailPrice(totalPrice)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '16px',
          margin: '0 0 24px 0',
        }}
      >
        <Text style={{ margin: '0 0 12px 0', fontWeight: 'bold', fontSize: '14px' }}>
          {guestInfo}
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 0', color: '#6b7280', width: '30%', fontSize: '14px' }}>
                {guestNameLabel}
              </td>
              <td style={{ padding: '4px 0', fontSize: '14px' }}>{guestName}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 0', color: '#6b7280', fontSize: '14px' }}>
                {guestEmailLabel}
              </td>
              <td style={{ padding: '4px 0', fontSize: '14px' }}>
                <a href={`mailto:${guestEmail}`} style={{ color: '#7c2d12' }}>
                  {guestEmail}
                </a>
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

export default WinemakerNewBookingEmail;
