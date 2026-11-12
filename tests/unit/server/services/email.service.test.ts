import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    RESEND_API_KEY: 'test_api_key',
  },
  getBaseUrl: () => 'https://test.encave.ch',
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Create mock Resend send method
const mockEmailsSend = vi.fn();

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

// Mock react-email render (+ the plain-text conversion of the HTML part)
vi.mock('@react-email/components', () => ({
  render: vi.fn().mockResolvedValue('<html>test email</html>'),
  toPlainText: vi.fn(() => 'test email'),
}));

// Mock email components
vi.mock('@/emails', () => ({
  BookingConfirmationEmail: vi.fn(() => null),
  BookingReminderEmail: vi.fn(() => null),
  BookingCancellationEmail: vi.fn(() => null),
  PasswordResetEmail: vi.fn(() => null),
  WelcomeEmail: vi.fn(() => null),
  EmailVerificationEmail: vi.fn(() => null),
  WinemakerNewBookingEmail: vi.fn(() => null),
  WinemakerCancellationEmail: vi.fn(() => null),
  WineryApprovedEmail: vi.fn(() => null),
  WineryRejectedEmail: vi.fn(() => null),
  ClientReminder2hEmail: vi.fn(() => null),
  DailyDigestEmail: vi.fn(() => null),
  PostExperienceFollowUpEmail: vi.fn(() => null),
  WeeklySummaryEmail: vi.fn(() => null),
  TastingRecapEmail: vi.fn(() => null),
  ContactMessageEmail: vi.fn(() => null),
  ContactAckEmail: vi.fn(() => null),
}));

// Mock attachment generators (kept hermetic — exercised in the service tests)
vi.mock('@/server/services/qr-code.service', () => ({
  generateBookingQrPng: vi.fn().mockResolvedValue(Buffer.from('qr')),
}));
vi.mock('@/server/services/booking-receipt.service', () => ({
  generateBookingReceiptPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
}));
vi.mock('@/lib/utils/calendar', () => ({
  createBookingCalendarEvent: vi.fn(() => ({})),
  generateICalEvent: vi.fn(() => 'BEGIN:VCALENDAR'),
}));

// Mock email translations
vi.mock('@/emails/translations', () => ({
  subjects: {
    bookingConfirmation: { FR: 'Confirmation', EN: 'Confirmation' },
    bookingReminder: { FR: 'Rappel', EN: 'Reminder' },
    bookingCancellation: { FR: 'Annulation', EN: 'Cancellation' },
    passwordReset: { FR: 'Mot de passe', EN: 'Password Reset' },
    welcome: { FR: 'Bienvenue', EN: 'Welcome' },
    emailVerification: { FR: 'Verification', EN: 'Verification' },
    wineryNewBooking: { FR: 'Nouvelle reservation', EN: 'New Booking' },
    wineryCancellation: { FR: 'Annulation', EN: 'Cancellation' },
    wineryApproved: { FR: 'Approuve', EN: 'Approved' },
    wineryRejected: { FR: 'Rejete', EN: 'Rejected' },
    reminder2h: { FR: 'Rappel 2h', EN: '2h Reminder' },
    dailyDigest: { FR: 'Digest', EN: 'Digest' },
    postExperience: { FR: 'Suivi', EN: 'Follow Up' },
    weeklySummary: { FR: 'Resume', EN: 'Summary' },
    tastingRecap: { FR: 'Recap {wineryName}', EN: 'Recap {wineryName}' },
    contactMessage: { FR: 'Contact {name}', EN: 'Contact {name}' },
    contactAck: { FR: 'Accuse', EN: 'Ack' },
  },
  t: vi.fn(
    (subject: Record<string, string>, locale: string) =>
      subject[locale] || subject.FR
  ),
}));

// Import after all mocks
const {
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
  sendBookingCancellationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmailVerificationEmail,
  sendWinemakerNewBookingEmail,
  sendWinemakerCancellationEmail,
  sendWineryApprovedEmail,
  sendWineryRejectedEmail,
  sendDailyDigestEmail,
  sendWeeklySummaryEmail,
  sendPostExperienceFollowUpEmail,
  sendTastingRecapEmail,
  sendContactMessageEmail,
  buildListUnsubscribeHeaders,
} = await import('@/server/services/email.service');

const { toPlainText } = await import('@react-email/components');

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailsSend.mockResolvedValue({ error: null });
  });

  describe('sendBookingConfirmationEmail', () => {
    const data = {
      guestName: 'John Doe',
      experienceTitle: 'Wine Tasting',
      wineryName: 'Test Winery',
      wineryAddress: 'Rue du Vin 1',
      wineryCommune: 'Sion',
      date: new Date('2025-06-15'),
      timeSlot: '14:00',
      guestCount: 4,
      duration: 90,
      totalPrice: 20000,
      bookingRef: 'REF-123',
    };

    it('sends email successfully', async () => {
      const result = await sendBookingConfirmationEmail(
        'test@example.com',
        data
      );

      expect(result).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('EnCave'),
          to: 'test@example.com',
        })
      );
    });

    it('returns false when Resend returns error', async () => {
      mockEmailsSend.mockResolvedValue({ error: 'Rate limited' });

      const result = await sendBookingConfirmationEmail(
        'test@example.com',
        data
      );

      expect(result).toBe(false);
    });

    it('retries on failure', async () => {
      mockEmailsSend
        .mockResolvedValueOnce({ error: 'Temporary error' })
        .mockResolvedValueOnce({ error: null });

      const result = await sendBookingConfirmationEmail(
        'test@example.com',
        data
      );

      expect(result).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledTimes(2);
    });

    it('uses default FR locale when not specified', async () => {
      await sendBookingConfirmationEmail('test@example.com', data);

      const { t } = await import('@/emails/translations');
      expect(t).toHaveBeenCalledWith(expect.any(Object), 'FR');
    });

    it('uses specified locale', async () => {
      await sendBookingConfirmationEmail('test@example.com', data, 'EN');

      const { t } = await import('@/emails/translations');
      expect(t).toHaveBeenCalledWith(expect.any(Object), 'EN');
    });
  });

  describe('sendBookingReminderEmail', () => {
    const data = {
      guestName: 'John',
      experienceTitle: 'Tour',
      wineryName: 'Winery',
      wineryAddress: 'Rue Test 1',
      date: new Date(),
      guestCount: 2,
      bookingRef: 'REF-1',
    };

    it('sends email successfully', async () => {
      const result = await sendBookingReminderEmail('test@example.com', data);
      expect(result).toBe(true);
    });
  });

  describe('sendBookingCancellationEmail', () => {
    const data = {
      guestName: 'John',
      experienceTitle: 'Tour',
      wineryName: 'Winery',
      date: new Date(),
      totalPrice: 5000,
      bookingRef: 'REF-1',
    };

    it('sends email successfully', async () => {
      const result = await sendBookingCancellationEmail(
        'test@example.com',
        data
      );
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends email successfully', async () => {
      const result = await sendPasswordResetEmail(
        'test@example.com',
        'John',
        'https://test.encave.ch/reset/token123'
      );
      expect(result).toBe(true);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('sends email successfully', async () => {
      const result = await sendWelcomeEmail('test@example.com', 'John');
      expect(result).toBe(true);
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('sends email successfully', async () => {
      const result = await sendEmailVerificationEmail(
        'test@example.com',
        'John',
        'https://test.encave.ch/verify/token123'
      );
      expect(result).toBe(true);
    });
  });

  describe('sendWinemakerNewBookingEmail', () => {
    const data = {
      winemakerName: 'Winemaker',
      experienceTitle: 'Tour',
      date: new Date(),
      guestCount: 2,
      totalPrice: 10000,
      guestName: 'Guest',
      guestEmail: 'guest@test.com',
      bookingRef: 'REF-1',
    };

    it('sends email successfully', async () => {
      const result = await sendWinemakerNewBookingEmail(
        'winemaker@test.com',
        data
      );
      expect(result).toBe(true);
    });
  });

  describe('sendWinemakerCancellationEmail', () => {
    const data = {
      winemakerName: 'Winemaker',
      experienceTitle: 'Tour',
      date: new Date(),
      guestCount: 2,
      guestName: 'Guest',
      bookingRef: 'REF-1',
    };

    it('sends email successfully', async () => {
      const result = await sendWinemakerCancellationEmail(
        'winemaker@test.com',
        data
      );
      expect(result).toBe(true);
    });
  });

  describe('sendWineryApprovedEmail', () => {
    it('sends email successfully', async () => {
      const result = await sendWineryApprovedEmail(
        'winemaker@test.com',
        'Winemaker',
        'Test Winery'
      );
      expect(result).toBe(true);
    });
  });

  describe('sendWineryRejectedEmail', () => {
    it('sends email successfully', async () => {
      const result = await sendWineryRejectedEmail(
        'winemaker@test.com',
        'Winemaker',
        'Test Winery',
        'Incomplete documentation'
      );
      expect(result).toBe(true);
    });
  });

  describe('sendDailyDigestEmail', () => {
    const data = {
      winemakerName: 'Winemaker',
      wineryName: 'Winery',
      todayBookings: [],
      tomorrowBookings: [],
      unsubscribeUrl:
        'https://test.encave.ch/api/unsubscribe/tok-winery?type=daily_digest',
    };

    it('sends email successfully', async () => {
      const result = await sendDailyDigestEmail('winemaker@test.com', data);
      expect(result).toBe(true);
    });
  });

  describe('sendWeeklySummaryEmail', () => {
    const data = {
      winemakerName: 'Winemaker',
      wineryName: 'Winery',
      lastWeekStats: { bookings: 5, guests: 20, revenue: 50000 },
      thisWeekPreview: { bookings: 3, guests: 12 },
      unsubscribeUrl:
        'https://test.encave.ch/api/unsubscribe/tok-winery?type=weekly_summary',
    };

    it('sends email successfully', async () => {
      const result = await sendWeeklySummaryEmail('winemaker@test.com', data);
      expect(result).toBe(true);
    });
  });

  describe('email hygiene — text part, reply-to, List-Unsubscribe', () => {
    const lastSend = () =>
      mockEmailsSend.mock.calls[mockEmailsSend.mock.calls.length - 1]?.[0];

    it('sends a plain-text alternative next to the HTML', async () => {
      await sendWelcomeEmail('test@example.com', 'John');

      expect(lastSend()).toMatchObject({
        html: '<html>test email</html>',
        text: 'test email',
      });
    });

    it('still sends when the plain-text conversion throws', async () => {
      vi.mocked(toPlainText).mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const result = await sendWelcomeEmail('test@example.com', 'John');

      expect(result).toBe(true);
      expect(lastSend()).not.toHaveProperty('text');
    });

    it('replies go to a real mailbox by default, never to noreply', async () => {
      await sendWelcomeEmail('test@example.com', 'John');

      expect(lastSend().from).toContain('noreply@encave.ch');
      expect(lastSend().replyTo).toBe('support@encave.ch');
    });

    it('keeps an explicit reply-to (contact form → the sender)', async () => {
      await sendContactMessageEmail({
        name: 'Jeanne',
        email: 'jeanne@example.com',
        subject: 'Question',
        message: 'Bonjour',
      });

      // 1st send = team notification, 2nd = accusé to the sender.
      expect(mockEmailsSend.mock.calls[0]?.[0].replyTo).toBe(
        'jeanne@example.com'
      );
      expect(mockEmailsSend.mock.calls[1]?.[0].replyTo).toBe(
        'support@encave.ch'
      );
    });

    it('transactional emails carry NO List-Unsubscribe header', async () => {
      await sendBookingReminderEmail('test@example.com', {
        guestName: 'John Doe',
        experienceTitle: 'Wine Tasting',
        wineryName: 'Test Winery',
        wineryAddress: 'Rue du Vin 1',
        date: new Date('2025-06-15'),
        guestCount: 2,
        bookingRef: 'REF-123',
      });

      expect(lastSend()).not.toHaveProperty('headers');
    });

    it('builds the RFC 8058 one-click header pair', () => {
      expect(buildListUnsubscribeHeaders('https://x.test/u/1')).toEqual({
        'List-Unsubscribe': '<https://x.test/u/1>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      });
    });

    it.each([
      [
        'daily digest',
        () =>
          sendDailyDigestEmail('winemaker@test.com', {
            winemakerName: 'Winemaker',
            wineryName: 'Winery',
            todayBookings: [],
            tomorrowBookings: [],
            unsubscribeUrl: 'https://test.encave.ch/api/unsubscribe/t1',
          }),
        'https://test.encave.ch/api/unsubscribe/t1',
      ],
      [
        'weekly summary',
        () =>
          sendWeeklySummaryEmail('winemaker@test.com', {
            winemakerName: 'Winemaker',
            wineryName: 'Winery',
            lastWeekStats: { bookings: 5, guests: 20, revenue: 50000 },
            thisWeekPreview: { bookings: 3, guests: 12 },
            unsubscribeUrl: 'https://test.encave.ch/api/unsubscribe/t2',
          }),
        'https://test.encave.ch/api/unsubscribe/t2',
      ],
      [
        'post-visit follow-up',
        () =>
          sendPostExperienceFollowUpEmail('guest@test.com', {
            guestName: 'Guest',
            experienceTitle: 'Wine Tasting',
            wineryName: 'Winery',
            date: new Date('2025-06-15'),
            unsubscribeUrl: 'https://test.encave.ch/api/unsubscribe/client/t3',
          }),
        'https://test.encave.ch/api/unsubscribe/client/t3',
      ],
      [
        'tasting recap',
        () =>
          sendTastingRecapEmail('guest@test.com', {
            bookingId: 'b1',
            wineryId: 'w1',
            guestName: 'Guest',
            wineryName: 'Winery',
            wines: [],
            orderUrl: 'https://test.encave.ch/fr/booking/b1/commande?token=x',
            unsubscribeUrl: 'https://test.encave.ch/api/unsubscribe/client/t4',
          }),
        'https://test.encave.ch/api/unsubscribe/client/t4',
      ],
    ])(
      '%s: List-Unsubscribe points at its tokenised URL',
      async (_name, send, url) => {
        await send();

        expect(lastSend().headers).toEqual({
          'List-Unsubscribe': `<${url}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        });
      }
    );
  });

  describe('retry behavior', () => {
    it('retries up to 3 times on error', async () => {
      mockEmailsSend
        .mockResolvedValueOnce({ error: 'Error 1' })
        .mockResolvedValueOnce({ error: 'Error 2' })
        .mockResolvedValueOnce({ error: 'Error 3' });

      const result = await sendWelcomeEmail('test@example.com', 'John');

      expect(result).toBe(false);
      expect(mockEmailsSend).toHaveBeenCalledTimes(3);
    });

    it('retries on thrown exceptions', async () => {
      mockEmailsSend
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ error: null });

      const result = await sendWelcomeEmail('test@example.com', 'John');

      expect(result).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledTimes(2);
    });
  });
});
