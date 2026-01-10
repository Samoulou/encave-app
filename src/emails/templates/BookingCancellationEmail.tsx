import { Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import {
  formatEmailDate,
  formatEmailTime,
  formatEmailPrice,
} from '../utils';
import { t, common, bookingCancellation, subjects } from '../translations';

export interface BookingCancellationEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  totalPrice: number; // in cents
  bookingRef: string;
  experiencesUrl: string;
}

export function BookingCancellationEmail({
  locale,
  guestName,
  experienceTitle,
  wineryName,
  date,
  totalPrice,
  bookingRef: _bookingRef,
  experiencesUrl,
}: BookingCancellationEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);
  const questions = t(common.questions, locale);

  const title = t(bookingCancellation.title, locale);
  const intro = t(bookingCancellation.intro, locale);
  const refund = t(bookingCancellation.refund, locale);
  const browseMore = t(bookingCancellation.browseMore, locale);

  const dateLabel = t(common.date, locale);
  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const wineryLabel = t(common.winery, locale);
  const priceLabel = t(common.price, locale);

  return (
    <EmailLayout locale={locale} preview={t(subjects.bookingCancellation, locale)}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', color: '#7c2d12', margin: '0 0 16px 0' }}>
        {title}
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {greeting} {guestName},
      </Text>

      <Text style={{ margin: '0 0 24px 0' }}>
        {intro}
      </Text>

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
              <td style={{ padding: '8px 0', color: '#6b7280', width: '40%' }}>{experienceLabel}</td>
              <td style={{ padding: '8px 0', fontWeight: '500' }}>{experienceTitle}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{wineryLabel}</td>
              <td style={{ padding: '8px 0' }}>{wineryName}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{dateLabel}</td>
              <td style={{ padding: '8px 0' }}>{formatEmailDate(date, locale)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{timeLabel}</td>
              <td style={{ padding: '8px 0' }}>{formatEmailTime(date, locale)}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>{priceLabel}</td>
              <td style={{ padding: '8px 0' }}>{formatEmailPrice(totalPrice)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Text style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}>
        {refund}
      </Text>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={experiencesUrl}>{browseMore}</EmailButton>
      </div>

      <Text style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '14px' }}>
        {questions}
      </Text>

      <Text style={{ margin: '24px 0 0 0' }}>
        {regards},
        <br />
        {team}
      </Text>
    </EmailLayout>
  );
}

export default BookingCancellationEmail;
