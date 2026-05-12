import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailDate, formatEmailTime, formatEmailGuests } from '../utils';
import { t, common, bookingReminder, subjects } from '../translations';

export interface BookingReminderEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  date: Date;
  guestCount: number;
  bookingRef: string;
  directionsUrl: string;
  isTomorrow?: boolean;
}

export function BookingReminderEmail({
  locale,
  guestName,
  experienceTitle,
  wineryName,
  wineryAddress,
  date,
  guestCount,
  bookingRef: _bookingRef,
  directionsUrl,
  isTomorrow = false,
}: BookingReminderEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(bookingReminder.title, locale);
  const intro = t(bookingReminder.intro, locale);
  const tomorrow = t(bookingReminder.tomorrow, locale);
  const directions = t(bookingReminder.directions, locale);

  const dateLabel = t(common.date, locale);
  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const wineryLabel = t(common.winery, locale);
  const guestsLabel = t(common.guests, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.bookingReminder, locale)}>
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

      {isTomorrow && (
        <div
          style={{
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            padding: '12px 16px',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}
        >
          <Text style={{ margin: 0, fontWeight: 'bold', color: '#92400e' }}>
            {tomorrow}
          </Text>
        </div>
      )}

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {guestName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      <Section
        style={{
          backgroundColor: '#fef7f0',
          borderRadius: '8px',
          padding: '24px',
          margin: '0 0 24px 0',
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
                {wineryLabel}
              </td>
              <td style={{ padding: '8px 0' }}>{wineryName}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {dateLabel}
              </td>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>
                {formatEmailDate(date, locale)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {timeLabel}
              </td>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>
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

      <Section
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          padding: '16px',
          margin: '0 0 24px 0',
        }}
      >
        <Text
          style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px' }}
        >
          {wineryName}
        </Text>
        <Text style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          {wineryAddress}
        </Text>
      </Section>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={directionsUrl}>{directions}</EmailButton>
      </div>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default BookingReminderEmail;
