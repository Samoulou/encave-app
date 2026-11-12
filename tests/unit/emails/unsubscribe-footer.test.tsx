import { describe, expect, it } from 'vitest';
import { render, toPlainText } from '@react-email/components';
import {
  BookingReminderEmail,
  DailyDigestEmail,
  PostExperienceFollowUpEmail,
  WeeklySummaryEmail,
} from '@/emails';

/**
 * REAL renders (no mocks): the footer opt-out link must be the tokenised
 * URL on the opt-out-able emails, and absent from transactional ones — a
 * link to a generic page that unsubscribes nobody is worse than none.
 */
const TOKEN_URL = 'https://encave.ch/api/unsubscribe/tok-123?type=daily_digest';

describe('email footer — tokenised opt-out link', () => {
  it('daily digest links to the tokenised winery URL', async () => {
    const html = await render(
      DailyDigestEmail({
        locale: 'FR',
        winemakerName: 'Léa',
        wineryName: 'Cave du Rhodan',
        todayBookings: [
          {
            time: '14:00',
            experienceTitle: 'Dégustation',
            guestName: 'Marc',
            guestCount: 2,
          },
        ],
        tomorrowBookings: [],
        dashboardUrl: 'https://encave.ch/dashboard/bookings',
        unsubscribeUrl: TOKEN_URL,
      })
    );

    expect(html).toContain(TOKEN_URL.replace('&', '&amp;'));
    expect(html).toContain('Se désinscrire de ces e-mails');
    expect(html).not.toContain('https://encave.ch/unsubscribe"');
  });

  it('weekly summary links to the tokenised winery URL', async () => {
    const url = 'https://encave.ch/api/unsubscribe/tok-123?type=weekly_summary';
    const html = await render(
      WeeklySummaryEmail({
        locale: 'DE',
        winemakerName: 'Léa',
        wineryName: 'Cave du Rhodan',
        lastWeekStats: { bookings: 2, guests: 5, revenue: 12000 },
        thisWeekPreview: { bookings: 1, guests: 2 },
        dashboardUrl: 'https://encave.ch/dashboard/earnings',
        unsubscribeUrl: url,
      })
    );

    expect(html).toContain(url);
    expect(html).toContain('Diese E-Mails abbestellen');
  });

  it('post-visit follow-up links to the tokenised client URL', async () => {
    const url = 'https://encave.ch/api/unsubscribe/client/tok-456';
    const html = await render(
      PostExperienceFollowUpEmail({
        locale: 'EN',
        guestName: 'Marc',
        experienceTitle: 'Tasting',
        wineryName: 'Cave du Rhodan',
        date: new Date('2026-11-20T13:00:00.000Z'),
        experiencesUrl: 'https://encave.ch/experiences',
        unsubscribeUrl: url,
      })
    );

    expect(html).toContain(url);
    expect(html).toContain('Unsubscribe from these emails');
  });

  it('a transactional email (J-1 reminder) shows no unsubscribe link', async () => {
    const html = await render(
      BookingReminderEmail({
        locale: 'FR',
        guestName: 'Marc',
        experienceTitle: 'Dégustation',
        wineryName: 'Cave du Rhodan',
        wineryAddress: 'Route du Vin 1, Sion',
        date: new Date('2026-11-20T13:00:00.000Z'),
        guestCount: 2,
        bookingRef: 'ENC-ABCD1234',
        isTomorrow: true,
        directionsUrl: 'https://maps.google.com/?q=Sion',
      })
    );

    expect(html).not.toContain('désinscrire');
    expect(html).not.toContain('/unsubscribe');
  });

  it('the plain-text alternative keeps the copy and the opt-out URL', async () => {
    const html = await render(
      DailyDigestEmail({
        locale: 'FR',
        winemakerName: 'Léa',
        wineryName: 'Cave du Rhodan',
        todayBookings: [],
        tomorrowBookings: [],
        dashboardUrl: 'https://encave.ch/dashboard/bookings',
        unsubscribeUrl: TOKEN_URL,
      })
    );
    const text = toPlainText(html);

    expect(text).toContain('Vos réservations du jour');
    expect(text).toContain(TOKEN_URL);
    expect(text).not.toContain('<');
  });
});
