import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: { findFirst: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
  },
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock payment service
vi.mock('@/server/services/payment.service', () => ({
  processRefund: vi.fn(),
}));

// Mock email service
vi.mock('@/server/services/email.service', () => ({
  sendBookingCancellationEmail: vi.fn().mockResolvedValue(true),
  sendWinemakerCancellationEmail: vi.fn().mockResolvedValue(true),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { processRefund } from '@/server/services/payment.service';
import {
  cancelClientBooking,
  updateClientProfile,
} from '@/server/actions/client.actions';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockProcessRefund = vi.mocked(processRefund);

describe('Client Actions', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'client@test.com',
      name: 'Test Client',
      role: 'CLIENT',
      preferredLocale: 'FR',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // cancelClientBooking
  // ========================================
  describe('cancelClientBooking', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    const mockBooking = {
      id: 'booking-123',
      visitorEmail: 'client@test.com',
      visitorName: 'Test Client',
      status: 'CONFIRMED',
      date: futureDate,
      timeSlot: '14:00',
      totalPrice: 10000,
      serviceFeeCents: 0,
      guestCount: 4,
      reference: 'REF-123',
      stripePaymentIntentId: 'pi_test123',
      experience: { title: 'Wine Tasting', duration: 90 },
      winery: {
        name: 'Test Winery',
        email: 'winery@test.com',
        cancellationPolicy: 'STANDARD',
        user: { name: 'Winemaker', preferredLocale: 'FR' },
      },
    };

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when booking not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockResolvedValueOnce(null);

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR when booking is not confirmed', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockResolvedValueOnce({
        ...mockBooking,
        status: 'CANCELLED_BY_CLIENT',
      } as never);

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('confirmed');
      }
    });

    it('returns VALIDATION_ERROR for past bookings', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockResolvedValueOnce({
        ...mockBooking,
        date: pastDate,
        timeSlot: '09:00',
      } as never);

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('past');
      }
    });

    it('successfully cancels with refund when >24h before', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockResolvedValueOnce(mockBooking as never);
      mockProcessRefund.mockResolvedValueOnce({
        refundId: 're_123',
        amount: 10000,
      });
      mockDb.booking.update.mockResolvedValueOnce({
        id: 'booking-123',
        status: 'CANCELLED_BY_CLIENT',
      } as never);

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refundIssued).toBe(true);
        expect(result.data.refundAmount).toBe(10000);
      }
    });

    it('returns PAYMENT_FAILED when refund processing fails', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockResolvedValueOnce(mockBooking as never);
      mockProcessRefund.mockRejectedValueOnce(new Error('Stripe error'));

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYMENT_FAILED');
      }
    });

    it('handles INTERNAL_ERROR from unexpected errors', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.booking.findFirst.mockRejectedValueOnce(new Error('DB error'));

      const result = await cancelClientBooking('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  // ========================================
  // updateClientProfile
  // ========================================
  describe('updateClientProfile', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await updateClientProfile({
        name: 'New Name',
        preferredLocale: 'EN',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns VALIDATION_ERROR for empty name', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);

      const result = await updateClientProfile({
        name: '',
        preferredLocale: 'FR',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns VALIDATION_ERROR for invalid locale', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);

      const result = await updateClientProfile({
        name: 'Test',
        preferredLocale: 'INVALID' as 'FR',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('successfully updates profile', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.user.update.mockResolvedValueOnce({} as never);

      const result = await updateClientProfile({
        name: 'New Name',
        preferredLocale: 'EN',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Name');
        expect(result.data.preferredLocale).toBe('EN');
      }
      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { name: 'New Name', preferredLocale: 'EN' },
      });
    });

    it('returns INTERNAL_ERROR when db throws', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.user.update.mockRejectedValueOnce(new Error('DB error'));

      const result = await updateClientProfile({
        name: 'New Name',
        preferredLocale: 'FR',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
