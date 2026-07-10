import { Img, Text, Section } from '@react-email/components';
import type { Locale } from '@prisma/client';
import { EmailLayout, EmailButton } from '../components';
import {
  formatEmailDate,
  formatEmailTime,
  formatEmailPrice,
  formatEmailDuration,
  formatEmailGuests,
} from '../utils';
import { t, common, bookingConfirmation, subjects } from '../translations';

export interface BookingConfirmationEmailProps {
  locale: Locale;
  guestName: string;
  experienceTitle: string;
  wineryName: string;
  date: Date;
  guestCount: number;
  duration: number; // in minutes
  totalPrice: number; // in cents (experience only, fee excluded)
  serviceFeeCents?: number; // client booking fee in cents
  bookingRef: string;
  bookingUrl: string;
  qrCodeCid?: string;
}

export function BookingConfirmationEmail({
  locale,
  guestName,
  experienceTitle,
  wineryName,
  date,
  guestCount,
  duration,
  totalPrice,
  serviceFeeCents = 0,
  bookingRef,
  bookingUrl,
  qrCodeCid,
}: BookingConfirmationEmailProps) {
  const greeting = t(common.greeting, locale);
  const regards = t(common.regards, locale);
  const team = t(common.team, locale);
  const questions = t(common.questions, locale);

  const title = t(bookingConfirmation.title, locale);
  const intro = t(bookingConfirmation.intro, locale);
  const details = t(bookingConfirmation.details, locale);
  const bookingRefLabel = t(bookingConfirmation.bookingRef, locale);
  const viewBooking = t(bookingConfirmation.viewBooking, locale);
  const lookingForward = t(bookingConfirmation.lookingForward, locale);

  const dateLabel = t(common.date, locale);
  const timeLabel = t(common.time, locale);
  const experienceLabel = t(common.experience, locale);
  const wineryLabel = t(common.winery, locale);
  const guestsLabel = t(common.guests, locale);
  const durationLabel = t(common.duration, locale);
  const priceLabel = t(common.price, locale);

  return (
    <EmailLayout
      locale={locale}
      preview={t(subjects.bookingConfirmation, locale)}
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
        <Text
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            margin: '0 0 16px 0',
            color: '#7c2d12',
          }}
        >
          {details}
        </Text>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280', width: '40%' }}>
                {bookingRefLabel}
              </td>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>
                {bookingRef}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
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
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {durationLabel}
              </td>
              <td style={{ padding: '8px 0' }}>
                {formatEmailDuration(duration, locale)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', color: '#6b7280' }}>
                {priceLabel}
              </td>
              <td
                style={{
                  padding: '8px 0',
                  fontWeight: 'bold',
                  color: '#7c2d12',
                }}
              >
                {formatEmailPrice(totalPrice + serviceFeeCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
        <EmailButton href={bookingUrl}>{viewBooking}</EmailButton>
      </div>

      <Section
        style={{
          backgroundColor: '#fff7ed',
          borderRadius: '8px',
          padding: '20px',
          margin: '0 0 24px 0',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            margin: '0 0 12px 0',
            color: '#7c2d12',
          }}
        >
          Votre billet
        </Text>
        <Text style={{ margin: '0 0 12px 0' }}>
          Presentez ce QR code a votre encaveur le jour J.
        </Text>
        {qrCodeCid ? (
          <Img
            src={`cid:${qrCodeCid}`}
            alt="QR code de votre billet EnCave"
            width="180"
            height="180"
            style={{ margin: '0 auto 12px auto' }}
          />
        ) : (
          <Text style={{ margin: '0 0 12px 0' }}>
            Retrouvez votre billet en ligne : {bookingUrl}
          </Text>
        )}
        <Text style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
          Reference : {bookingRef}
        </Text>
      </Section>

      <Text style={{ margin: '0 0 16px 0', fontWeight: 'bold' }}>
        Cette experience est reservee aux personnes majeures (18 ans). Une piece
        d&apos;identite pourra etre demandee sur place.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>{lookingForward}</Text>

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

export default BookingConfirmationEmail;
