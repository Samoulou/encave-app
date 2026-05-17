import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock email service
vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(true),
}));

describe('Booking Notification Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resendConfirmationEmail', () => {
    const mockConfirmedBooking = {
      id: 'booking-1',
      reference: 'ENC-ABC123',
      status: BookingStatus.CONFIRMED,
      visitorName: 'John Doe',
      visitorEmail: 'john@example.com',
      date: new Date('2026-03-15'),
      timeSlot: '14:00',
      guestCount: 4,
      totalPrice: 20000,
      experience: {
        title: 'Wine Tasting',
        duration: 90,
      },
      winery: {
        name: 'Test Winery',
      },
    };

    it('sends email for confirmed booking', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue(
        mockConfirmedBooking as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { resendConfirmationEmail } =
        await import('@/server/actions/booking');
      const result = await resendConfirmationEmail('booking-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sent).toBe(true);
      }
    });

    it('returns NOT_FOUND when booking does not exist', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue(null);

      const { resendConfirmationEmail } =
        await import('@/server/actions/booking');
      const result = await resendConfirmationEmail('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR for non-confirmed booking', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue({
        ...mockConfirmedBooking,
        status: BookingStatus.PENDING_PAYMENT,
      } as never);

      const { resendConfirmationEmail } =
        await import('@/server/actions/booking');
      const result = await resendConfirmationEmail('booking-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('updates confirmationSentAt on successful send', async () => {
      vi.mocked(db.booking.findUnique).mockResolvedValue(
        mockConfirmedBooking as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { resendConfirmationEmail } =
        await import('@/server/actions/booking');
      await resendConfirmationEmail('booking-1');

      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: { confirmationSentAt: expect.any(Date) },
      });
    });
  });

  describe('getBookingByToken', () => {
    const accessToken = 'test-access-token-12345';
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const mockBooking = {
      id: 'booking-1',
      reference: 'ENC-XYZ789',
      status: BookingStatus.CONFIRMED,
      visitorName: 'Jane Doe',
      visitorEmail: 'jane@example.com',
      visitorPhone: '+41791234567',
      date: new Date('2026-04-20'),
      timeSlot: '10:00',
      guestCount: 2,
      totalPrice: 10000,
      accessToken,
      accessTokenHash: tokenHash,
      experience: {
        title: 'Cellar Visit',
        slug: 'cellar-visit',
        duration: 60,
        coverPhoto: 'https://example.com/photo.jpg',
      },
      winery: {
        name: 'Test Winery',
        slug: 'test-winery',
        address: '123 Wine St',
        commune: 'Sion',
        phone: '+41271234567',
        email: 'winery@example.com',
      },
    };

    it('returns booking for valid token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken(accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reference).toBe('ENC-XYZ789');
        expect(result.data.visitorName).toBe('Jane Doe');
      }
    });

    it('searches by SHA-256 token hash', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      await getBookingByToken(accessToken);

      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accessTokenHash: tokenHash,
          },
        })
      );
    });

    it('returns NOT_FOUND for invalid token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken('invalid-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('includes all booking details in response', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken(accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experience.title).toBe('Cellar Visit');
        expect(result.data.winery.name).toBe('Test Winery');
        expect(result.data.winery.address).toBe('123 Wine St');
      }
    });
  });
});
