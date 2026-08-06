import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import { formatEmailTime } from '../utils';
import { t, common, clientReminder2h, subjects } from '../translations';

export interface ClientReminder2hEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  wineryAddress: string;
  wineryPhone: string;
  date: Date;
  guestCount: number;
  directionsUrl: string;
}

export function ClientReminder2hEmail({
  locale,
  guestName,
  experienceTitle,
  wineryName,
  wineryAddress,
  wineryPhone,
  date,
  guestCount,
  directionsUrl,
}: ClientReminder2hEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);

  const title = t(clientReminder2h.title, locale);
  const intro = t(clientReminder2h.intro, locale);
  const startsSoon = t(clientReminder2h.startsSoon, locale);
  const directions = t(clientReminder2h.directions, locale);
  const contact = t(clientReminder2h.contact, locale);

  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const guestsLabel = t(common.guests, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.reminder2h, locale)}>
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

      {/* Urgency Banner */}
      <div
        style={{
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          padding: '16px',
          margin: '0 0 24px 0',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            margin: 0,
            fontWeight: 'bold',
            fontSize: '18px',
            color: '#92400e',
          }}
        >
          {startsSoon}
        </Text>
        <Text
          style={{
            margin: '8px 0 0 0',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#7c2d12',
          }}
        >
          {formatEmailTime(date, locale)}
        </Text>
      </div>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {guestName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>{intro}</Text>

      {/* Quick Details */}
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
                {timeLabel}
              </td>
              <td
                style={{
                  padding: '8px 0',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  color: '#7c2d12',
                }}
              >
                {formatEmailTime(date, locale)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {guestsLabel}
              </td>
              <td style={{ padding: '8px 0' }}>{guestCount}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Location */}
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
        <Text
          style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}
        >
          {wineryAddress}
        </Text>
        <Text style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          {contact}: {wineryPhone}
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

export default ClientReminder2hEmail;
